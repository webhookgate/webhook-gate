import express from "express";
import { PORT } from "./config.js";
import { tryMarkReceived } from "./db.js";

const app = express();

// Parse JSON request bodies (most webhooks send JSON)
app.use(express.json());

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

// MVP: send { provider, eventId, payload }
app.post("/ingest", (req, res) => {
  const provider = String(req.body?.provider || "");
  const eventId = String(req.body?.eventId || "");

  if (!provider || !eventId) {
    return res
      .status(400)
      .json({ ok: false, error: "provider and eventId are required" });
  }

  const { firstTime } = tryMarkReceived(provider, eventId);

  if (!firstTime) {
    console.log(`[dedupe] ${provider} ${eventId}`);
  } else {
    console.log(`[accept] ${provider} ${eventId}`);
  }

  // Always return 200 to stop retries
  return res.status(200).json({ ok: true, firstTime });
});

app.listen(PORT, () => {
  console.log(`WebhookGate listening on ${PORT}`);
});
