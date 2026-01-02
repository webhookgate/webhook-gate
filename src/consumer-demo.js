import "dotenv/config";
import express from "express";
import { Pool } from "pg";
import { idempotent } from "./idempotent.js";

const app = express();
app.use(express.json());

let crashedOnce = false;

const statsPool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});

async function chargeCustomer({ db, key }) {
  await db.query(
    `INSERT INTO demo_charges (idempotency_key) VALUES ($1)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [key]
  );
}
async function sendReceipt(_) {}

app.post(
  "/webhooks/stripe",
  idempotent(async ({ event, db, req }) => {
    const key = (req.get("Idempotency-Key") || req.get("idempotency-key") || "").trim();

    await chargeCustomer({ db, key });

    if (process.env.CRASH_ONCE === "true" && !crashedOnce) {
      crashedOnce = true;
      console.log("[consumer] crashing after charge (CRASH_ONCE=true)");
      process.exit(1);
    }

    await sendReceipt(event);
  })
);

app.get("/stats", async (_, res) => {
  try {
    const r = await statsPool.query(`SELECT COUNT(*)::int AS charges FROM demo_charges`);
    return res.json({ charges: r.rows[0].charges });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

process.on("SIGINT", async () => {
  await statsPool.end().catch(() => {});
  process.exit(0);
});

app.listen(4000, () => console.log("consumer demo on 4000"));
