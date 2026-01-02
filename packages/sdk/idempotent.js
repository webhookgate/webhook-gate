import { Pool } from "pg";

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});

let _readyPromise = null;

async function ensureTables() {
  if (_readyPromise) return _readyPromise;

  _readyPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS webhook_idempotency (
        idempotency_key TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('processing','done','failed')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        completed_at TIMESTAMPTZ
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS demo_charges (
        id BIGSERIAL PRIMARY KEY,
        idempotency_key TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  })();

  return _readyPromise;
}

function getIdempotencyKey(req) {
  // Primary: what our gateway sends
  const k = req.get("Idempotency-Key") || req.get("idempotency-key");
  return k ? String(k).trim() : "";
}

/**
 * Locked API:
 * app.post("/webhooks/stripe", idempotent(async ({ req, event, db }) => {}))
 *
 * Guarantees:
 * - first time key seen: handler runs
 * - any repeat of same key: handler does NOT run (returns 200)
 * - crash or error mid-handler: key transitions to 'failed' and is never re-run
 */
export function idempotent(handler) {
  return async function idempotentMiddleware(req, res) {
    await ensureTables();

    const key = getIdempotencyKey(req);

    if (!key) {
      return res.status(400).json({
        ok: false,
        error: "Missing Idempotency-Key header",
      });
    }

    // IMPORTANT: the SDK assumes req.body already contains the parsed event
    const event = req.body;

    const client = await pool.connect();
    let inTxn = false;
    try {
      // Atomic "claim"
      // If it inserts: we own execution.
      // If it conflicts: someone already claimed (or finished) => skip.
      const claimed = await client.query(
        `
        INSERT INTO webhook_idempotency (idempotency_key, status)
        VALUES ($1, 'processing')
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING idempotency_key
        `,
        [key]
      );

      if (claimed.rowCount === 0) {
        // Already seen => do nothing (exactly-once effects)
        return res.status(200).json({ ok: true, deduped: true });
      }

      // 2) Transaction boundary for DB effects inside handler
      await client.query("BEGIN");
      inTxn = true;

      // Run user handler
      await handler({ req, res, event, db: client });

      // Mark done
      await client.query(
        `
        UPDATE webhook_idempotency
        SET status='done', completed_at=now()
        WHERE idempotency_key=$1
        `,
        [key]
      );

      await client.query("COMMIT");
      inTxn = false;

      // If handler already wrote to res, don't double-send.
      if (!res.headersSent) {
        return res.status(200).json({ ok: true, deduped: false });
      }
    } catch (err) {
      // best-effort rollback if handler started a txn
      try {
        if (inTxn) await client.query("ROLLBACK");
      } catch (_) {}

      // Optional: mark failed (still prevents reruns, which is the contract you chose)
      try {
        await client.query(
          `
          UPDATE webhook_idempotency
          SET status='failed', completed_at=now()
          WHERE idempotency_key=$1 AND status='processing'
          `,
          [key]
        );
      } catch (_) {
        // ignore secondary failure
      }

      if (!res.headersSent) {
        return res.status(500).json({ ok: false, error: err?.message || String(err) });
      }
    } finally {
      client.release();
    }
  };
}
