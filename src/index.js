import express from "express";
import { PORT } from "./config.js";

const app = express();

// Parse JSON request bodies (most webhooks send JSON)
app.use(express.json());

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`WebhookGate listening on ${PORT}`);
});
