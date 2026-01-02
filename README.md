# WebhookGate

WebhookGate guarantees **no duplicate webhook side effects**.

It does this by combining:
- **durable webhook intake and de-duplication** at the gateway layer, and
- a **consumer-side idempotency SDK** that makes duplicate side effects **structurally impossible** within the consumer.

WebhookGate sits in front of webhook consumers and ensures that each `(provider, eventId)` is **accepted exactly once**, even under retries, replays, or noisy providers - and that downstream effects are never duplicated when the consumer uses the SDK.

---

## What WebhookGate guarantees (MVP)

WebhookGate provides a durable webhook “inbox” in front of your consumer.

### Gateway guarantees

- **Exactly-once acceptance** per `(provider, eventId)`
- **De-duplication at intake**: repeated deliveries of the same event are not re-accepted
- **Durable delivery jobs + transport retries**: downstream delivery is retried on network/transport failure
- **Deterministic Idempotency-Key propagation** on every downstream delivery

The gateway delivers events **at-least-once** downstream, always with the same
Idempotency-Key, even across retries, crashes, or restarts.

---

## Consumer SDK: No duplicate side effects

The consumer SDK converts delivery guarantees into **hard correctness**.

### What the SDK guarantees

- **At-most-once execution** of the handler per Idempotency-Key
- **Duplicate deliveries never re-run side effects**
- **Crash-safe behavior**: if the process crashes mid-handler, the handler is never re-entered (row remains processing)
- **Error behavior (terminal)**: if the handler throws, the idempotency row transitions to 'failed' and is never re-entered automatically
- **Transactional DB effects** for database operations performed via the provided db client

Once a key is successfully claimed, the handler will **never** be executed again — even if the process crashes, restarts, or receives the same event repeatedly.

> Result: side effects are never duplicated.

---

## Exactly-once effects (clarified)

WebhookGate guarantees that your handler runs at most once per Idempotency-Key.

If your handler calls external systems (payments, email providers, APIs), those systems must respect idempotency keys to achieve end-to-end exactly-once effects across system boundaries.

This design deliberately favors **safety over re-execution**:
WebhookGate will never risk double-charging, double-emailing, or double-writing.

---

## What the developer writes (locked API)

```js
import { idempotent } from "./src/idempotent.js";

app.post(
  "/webhooks/stripe",
  idempotent(async ({ event, db }) => {
    await chargeCustomer(event);   // never executed twice
    await sendReceipt(event);      // never executed twice
  })
);
```

---

## Proof: No duplicate side effects (60 seconds)

1. Start Postgres
2. Install dependencies
   npm install
3. Start the consumer
   npm run consumer
4. Start the gateway
   npm run dev
5. Send a replay storm
   npm run chaos -- evt_test_1

Result:
- Gateway receives 50 duplicate events
- Consumer executes the handler once
- /stats shows charges = 1

Crash test:
- Start consumer with CRASH_ONCE=true
- Re-run chaos
- Restart consumer
- Charges still = 1
