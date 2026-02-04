export const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

export const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";
export const TARGET_URL = process.env.TARGET_URL || "";

export const RETRY_INTERVAL_MS = process.env.RETRY_INTERVAL_MS
  ? Number(process.env.RETRY_INTERVAL_MS)
  : 3000;

export const DELIVER_TIMEOUT_MS = process.env.DELIVER_TIMEOUT_MS
  ? Number(process.env.DELIVER_TIMEOUT_MS)
  : 5000;

export const INGEST_TOKEN = process.env.INGEST_TOKEN || "";

export const MODE = (process.env.WEBHOOKGATE_MODE || "observe").toLowerCase(); // "observe" | "enforce"
export const LICENSE_KEY = (process.env.WEBHOOKGATE_LICENSE_KEY || "").trim();

export const ENFORCEMENT_API_KEY_HEADER = (process.env.ENFORCEMENT_API_KEY_HEADER || "X-WebhookGate-Key").trim();