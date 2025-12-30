import Database from "better-sqlite3";

const dbPath = process.env.SQLITE_PATH || "./data/webhookgate.sqlite";
const db = new Database(dbPath);

// WAL helps reliability under concurrent access
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS receipts (
    provider   TEXT NOT NULL,
    event_id   TEXT NOT NULL,
    received_at INTEGER NOT NULL,
    PRIMARY KEY (provider, event_id)
  );
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
    // SQLITE_CONSTRAINT_PRIMARYKEY means it's a duplicate
    if (String(err && err.code) === "SQLITE_CONSTRAINT_PRIMARYKEY") {
      return { firstTime: false };
    }
    throw err;
  }
}