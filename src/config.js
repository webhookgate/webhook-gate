export const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Optional shared secret for simple webhook auth (recommended for MVP)
export const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";
