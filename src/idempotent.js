export function idempotent(handler) {
  return async function (req, res) {
    const key = req.header("Idempotency-Key");

    if (!key) {
      res.status(400).json({ error: "Missing Idempotency-Key" });
      return;
    }

    const db = req.app.get("db"); // consumer provides pg client

    // 1. Try to claim the key
    const result = await db.query(
      `
      INSERT INTO webhook_idempotency (idempotency_key, status)
      VALUES ($1, 'processing')
      ON CONFLICT DO NOTHING
      `,
      [key]
    );

    // 2. If we didn't insert, this event was already seen
    if (result.rowCount === 0) {
      res.status(200).end(); // safe, silent skip
      return;
    }

    try {
      // 3. Run the handler exactly once
      await handler({ req, res });

      // 4. Mark done
      await db.query(
        `
        UPDATE webhook_idempotency
        SET status='done', completed_at=now()
        WHERE idempotency_key=$1
        `,
        [key]
      );

      res.status(200).end();
    } catch (err) {
      // IMPORTANT: we do NOT retry
      // Leaving status=processing is intentional
      throw err;
    }
  };
}
