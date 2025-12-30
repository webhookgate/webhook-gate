import express from "express";

const app = express();

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`WebhookGate listening on ${port}`);
});