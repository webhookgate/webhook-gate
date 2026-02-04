import "dotenv/config";
import express from "express";
import {
  PORT,
  TARGET_URL,
  RETRY_INTERVAL_MS,
  DELIVER_TIMEOUT_MS,
  INGEST_TOKEN,
  MODE,
  LICENSE_KEY,
} from "./config.js";
import {
  tryMarkReceived,
  upsertDelivery,
  getPendingDeliveries,
  markDelivered,
  markAttemptFailed,
} from "./db.js";

const app = express();
app.use(express.json());

app.get("/health", (_, res) => res.json({ ok: true }));

function isEnforceMode() {
  return MODE === "enforce";
}

function hasValidLicense() {
  // Minimal v1: any non-empty key enables enforcement.
  // Later: verify signature / call license server / etc.
  return Boolean(LICENSE_KEY);
}

function withTimeout(ms) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(t) };
}

async function deliverOne({ provider, eventId, targetUrl, payload }) {
  const key = `${provider}:${eventId}:${targetUrl}`;

  const { signal, cancel } = withTimeout(DELIVER_TIMEOUT_MS);
  try {
    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        "X-WebhookGate-Provider": provider,
        "X-WebhookGate-EventId": eventId,
      },
      body: JSON.stringify(payload ?? null),
      signal,
    });

    if (!resp.ok) {
      console.log(`[downstream-non2xx] ${key} ${resp.status} ${resp.statusText}`);
      markAttemptFailed(provider, eventId, targetUrl, `${resp.status} ${resp.statusText}`);
      return false;
    }

    markDelivered(provider, eventId, targetUrl);
    console.log(`[deliver-ok] ${key}`);
    return true;

  } catch (err) {
    markAttemptFailed(provider, eventId, targetUrl, err?.message || String(err));
    console.log(`[deliver-fail] ${key} ${err?.message || String(err)}`);
    return false;
  } finally {
    cancel();
  }
}

// MVP: send { provider, eventId, payload }
app.post("/ingest", async (req, res) => {
  const provider = String(req.body?.provider || "");
  const eventId = String(req.body?.eventId || "");
  const payload = req.body?.payload;

  if (INGEST_TOKEN) {
    const t = String(req.get("X-WebhookGate-Token") || "");
    if (t !== INGEST_TOKEN) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
  }

  if (!provider || !eventId) {
    return res.status(400).json({ ok: false, error: "provider and eventId are required" });
  }

  if (!TARGET_URL) {
    return res.status(500).json({ ok: false, error: "TARGET_URL is not set" });
  }

  let firstTime = false;
  let receiptKnown = true;

  try {
    ({ firstTime } = tryMarkReceived(provider, eventId));
  } catch (err) {
    receiptKnown = false;

    // FAIL-CLOSED: if we cannot verify state in enforcement mode, do not forward.
    if (isEnforceMode()) {
      console.log(
        `[block] cannot verify receipt state (enforcement mode) ${provider} ${eventId} ${err?.message || String(err)}`
      );
      return res.status(503).json({ ok: false, error: "Invariant unverifiable (receipt store unavailable)" });
    }

    // OBSERVE MODE: best-effort; still forward even if receipt tracking fails
    console.log(
      `[observe] receipt tracking failed, forwarding anyway ${provider} ${eventId} ${err?.message || String(err)}`
    );
    firstTime = true;
  }

  // FAIL-CLOSED: enforcement requires a license
  if (isEnforceMode() && !hasValidLicense()) {
    console.log(`[block] enforcement mode requires license ${provider} ${eventId}`);
    return res.status(402).json({ ok: false, error: "License required for enforcement mode" });
  }

  // Behavior split:
  if (!firstTime) {
    if (isEnforceMode()) {
      // ENFORCEMENT: block duplicates (current behavior)
      console.log(`[dedupe] ${provider} ${eventId}`);
      return res.status(200).json({ ok: true, firstTime: false, mode: "enforce", blocked: true });
    } else {
      // OBSERVATIONAL: allow duplicates through, but log clearly
      console.log(`[observe-dup] ${provider} ${eventId} side effects may execute again`);
    }
  } else {
    console.log(`[accept] ${provider} ${eventId}`);
  }

  // Store delivery job durably so retries are possible
  upsertDelivery({ provider, eventId, targetUrl: TARGET_URL, payload });

  // Best-effort immediate delivery attempt
  const delivered = await deliverOne({ provider, eventId, targetUrl: TARGET_URL, payload });

  // Even if not delivered yet, we return 200 to stop webhook retry storms.
  return res.status(200).json({
    ok: true,
    firstTime,
    receiptKnown,
    delivered,
    mode: isEnforceMode() ? "enforce" : "observe",
  });
});

// Simple in-process retry loop (MVP)
let draining = false;
async function drainOnce() {
  if (draining) return;
  draining = true;

  try {
    // FAIL-CLOSED: don’t deliver pending jobs if enforcement mode is selected but not licensed
    if (isEnforceMode() && !hasValidLicense()) {
      console.log("[block] enforcement mode requires license (drain loop)");
      return;
    }

    const jobs = getPendingDeliveries(25);
    for (const j of jobs) {
      const payload = JSON.parse(j.payloadJson);
      await deliverOne({ provider: j.provider, eventId: j.eventId, targetUrl: j.targetUrl, payload });
    }
  } finally {
    draining = false;
  }
}

setInterval(() => {
  drainOnce().catch((e) => console.log(`[drain-error] ${e?.message || String(e)}`));
}, RETRY_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(
    `WebhookGate listening on ${PORT} mode=${isEnforceMode() ? "enforce" : "observe"} license=${hasValidLicense() ? "present" : "missing"}`
  );
});
