# WebhookGate

WebhookGate guarantees **exactly-once webhook side effects**.

It does this by combining:
- durable webhook intake and de-duplication at the gateway layer, and
- a consumer-side idempotency SDK that makes duplicate side effects structurally impossible.

WebhookGate sits in front of webhook consumers and ensures that each `(provider, eventId)` is **accepted and forwarded at most once by WebhookGate**, even under retries, replays, or noisy providers.

## What WebhookGate guarantees (MVP)

WebhookGate gives you a durable webhook “inbox” in front of your consumer:

- **Exactly-once acceptance** into WebhookGate per `(provider, eventId)`
- **De-duplication**: repeated deliveries of the same event are not forwarded again
- **Durable forwarding jobs + retries**: if downstream is temporarily down, WebhookGate retries
- **Idempotency-Key propagation** to enable exactly-once side effects downstream

## Consumer SDK: Exactly-once effects

The consumer SDK closes the loop and converts delivery guarantees into **hard exactly-once side effects**.

### What the developer writes (locked API)

```js
import { idempotent } from "./src/idempotent.js";

app.post(
  "/webhooks/stripe",
  idempotent(async ({ req }) => {
    await chargeCustomer(req.body);
    await sendReceipt(req.body);
  })
);
