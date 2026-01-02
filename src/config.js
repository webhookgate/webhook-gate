export const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Optional shared secret for webhook auth later
export const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

// Where to forward accepted webhooks
export const TARGET_URL = process.env.TARGET_URL || "";

// Retry loop tuning (MVP defaults)
export const RETRY_INTERVAL_MS = process.env.RETRY_INTERVAL_MS
  ? Number(process.env.RETRY_INTERVAL_MS)
  : 3000;

export const DELIVER_TIMEOUT_MS = process.env.DELIVER_TIMEOUT_MS
  ? Number(process.env.DELIVER_TIMEOUT_MS)
  : 5000;

export const INGEST_TOKEN = process.env.INGEST_TOKEN || "";
