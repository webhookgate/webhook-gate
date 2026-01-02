// scripts/chaos.js
import "dotenv/config";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000/ingest";
const TOKEN = process.env.INGEST_TOKEN || "";
const CONSUMER = process.env.CONSUMER_URL || "http://localhost:4000";

async function postIngest({ provider, eventId, payload }) {
  const resp = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(TOKEN ? { "X-WebhookGate-Token": TOKEN } : {}),
    },
    body: JSON.stringify({ provider, eventId, payload }),
  });
  const json = await resp.json().catch(() => ({}));
  return { status: resp.status, json };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getStats() {
  const resp = await fetch(`${CONSUMER}/stats`);
  const json = await resp.json().catch(() => ({}));
  return { status: resp.status, json };
}

async function main() {
  const provider = "stripe";
  const eventId = process.argv[2] || "evt_test_1";

  // Burst duplicates concurrently
  const N = 50;
  const results = await Promise.all(
    Array.from({ length: N }).map((_, i) =>
      postIngest({
        provider,
        eventId,
        payload: { n: i, ts: Date.now() },
      })
    )
  );

  const firstTimeCount = results.filter((r) => r.json?.firstTime).length;
  console.log({ sent: N, firstTimeCount, sample: results[0] });

  // Fetch consumer stats (give gateway a moment to deliver + retry loop to run)
  let stats;
  for (let attempt = 1; attempt <= 10; attempt++) {
    stats = await getStats().catch(() => null);

    if (stats && stats.status === 200) {
      // If your consumer increments charges, this prints the proof
      console.log({ consumerStats: stats.json, attempt });
      break;
    }

    await sleep(250);
  }

  if (!stats || stats.status !== 200) {
    console.log({ consumerStats: null, error: "Failed to fetch /stats from consumer" });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
