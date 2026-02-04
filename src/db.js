import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dbPath = process.env.SQLITE_PATH || "./data/webhookgate.sqlite";

// ensure ./data exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

// WAL helps reliability under concurrent access
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS receipts (
    provider    TEXT NOT NULL,
    event_id    TEXT NOT NULL,
    received_at INTEGER NOT NULL,
    PRIMARY KEY (provider, event_id)
  );

  CREATE TABLE IF NOT EXISTS deliveries (
    provider     TEXT NOT NULL,
    event_id     TEXT NOT NULL,
    target_url   TEXT NOT NULL,
    payload_json TEXT NOT NULL,

    status       TEXT NOT NULL DEFAULT 'pending', -- pending | delivered | failed
    attempts     INTEGER NOT NULL DEFAULT 0,
    last_error   TEXT,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    delivered_at INTEGER,

    PRIMARY KEY (provider, event_id, target_url)
  );

  CREATE INDEX IF NOT EXISTS idx_deliveries_status_updated
    ON deliveries(status, updated_at);

  CREATE TABLE IF NOT EXISTS api_keys (
    id           TEXT PRIMARY KEY,
    key_hash     TEXT NOT NULL UNIQUE,
    label        TEXT,
    plan         TEXT NOT NULL DEFAULT 'starter',
    is_active    INTEGER NOT NULL DEFAULT 1,
    created_at   INTEGER NOT NULL,
    last_used_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_api_keys_active
    ON api_keys(is_active);
`);

export function tryMarkReceived(provider, eventId) {
  const stmt = db.prepare(`
    INSERT INTO receipts (provider, event_id, received_at)
    VALUES (?, ?, ?)
  `);

  try {
    stmt.run(provider, eventId, Date.now());
    return { firstTime: true };
  } catch (err) {
    const code = String(err && err.code);
    if (code.startsWith("SQLITE_CONSTRAINT")) {
      return { firstTime: false };
    }
    throw err;
  }
}

export function upsertDelivery({ provider, eventId, targetUrl, payload }) {
  const now = Date.now();
  const payloadJson = JSON.stringify(payload ?? null);

  // If delivery already exists, keep the original payload (don’t overwrite).
  const stmt = db.prepare(`
    INSERT INTO deliveries (provider, event_id, target_url, payload_json, status, attempts, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', 0, ?, ?)
    ON CONFLICT(provider, event_id, target_url) DO NOTHING
  `);

  stmt.run(provider, eventId, targetUrl, payloadJson, now, now);
}

export function getPendingDeliveries(limit = 25) {
  const stmt = db.prepare(`
    SELECT provider, event_id as eventId, target_url as targetUrl, payload_json as payloadJson, attempts
    FROM deliveries
    WHERE status = 'pending'
    ORDER BY updated_at ASC
    LIMIT ?
  `);
  return stmt.all(limit);
}

export function markDelivered(provider, eventId, targetUrl) {
  const now = Date.now();
  const stmt = db.prepare(`
    UPDATE deliveries
    SET status='delivered', delivered_at=?, updated_at=?
    WHERE provider=? AND event_id=? AND target_url=?
  `);
  stmt.run(now, now, provider, eventId, targetUrl);
}

export function markAttemptFailed(provider, eventId, targetUrl, message) {
  const MAX = Number(process.env.MAX_ATTEMPTS || 25);
  const now = Date.now();
  const stmt = db.prepare(`
    UPDATE deliveries
    SET attempts = attempts + 1,
        last_error = ?,
        status = CASE WHEN attempts + 1 >= ? THEN 'failed' ELSE status END,
        updated_at = ?
    WHERE provider=? AND event_id=? AND target_url=? AND status='pending'
  `);
  stmt.run(String(message || "unknown error"), MAX, now, provider, eventId, targetUrl);
}

export function insertApiKey({ id, keyHash, label = "", plan = "starter" }) {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO api_keys (id, key_hash, label, plan, is_active, created_at)
    VALUES (?, ?, ?, ?, 1, ?)
  `);
  stmt.run(id, keyHash, label, plan, now);
}

export function findActiveApiKeyByHash(keyHash) {
  const stmt = db.prepare(`
    SELECT id, plan, is_active
    FROM api_keys
    WHERE key_hash = ? AND is_active = 1
    LIMIT 1
  `);
  return stmt.get(keyHash) || null;
}

export function touchApiKeyLastUsed(id) {
  const now = Date.now();
  const stmt = db.prepare(`
    UPDATE api_keys
    SET last_used_at = ?
    WHERE id = ?
  `);
  stmt.run(now, id);
}
