# WebhookGate

WebhookGate guarantees **no duplicate webhook side effects**.

https://webhookgate.com

WebhookGate exists to draw a hard line in reality:

> **Past this point, duplicate side effects cannot exist.**

It does this by combining:
- **durable webhook intake and de-duplication** at the gateway layer, and
- a **consumer-side idempotency SDK** that makes duplicate side effects **structurally impossible** within the consumer.

WebhookGate sits in front of webhook consumers and ensures that each `(provider, eventId)` is **accepted exactly once**, even under retries, replays, or noisy providers — and ensures downstream effects are never duplicated when the consumer uses the SDK.

---

## Documentation (problem-first)

If you want to understand *why* WebhookGate exists — not just how to use it — start here:

- **Why Webhook Retries Cause Duplicate Side Effects**  
  https://webhookgate.com/docs/why-retries-cause-duplicates

- **Exactly-once Delivery Is a Myth**  
  https://webhookgate.com/docs/exactly-once-is-a-myth

- **What a Real Guarantee Requires**  
  https://webhookgate.com/docs/what-a-real-guarantee-requires

These documents explain the distributed-systems constraints that make ad-hoc idempotency fragile,
and the architectural boundaries required to make duplicate side effects impossible.

---

## What WebhookGate guarantees (MVP)

WebhookGate provides a durable webhook **inbox** in front of your consumer.

### Gateway guarantees

- **Exactly-once acceptance** per `(provider, eventId)`
- **De-duplication at intake**: repeated deliveries of the same event are not re-accepted
- **Durable delivery jobs + transport retries**
- **Deterministic Idempotency-Key propagation** on every downstream delivery

The gateway delivers events **at-least-once** downstream, always with the same Idempotency-Key, even across retries, crashes, or restarts.

> Intake is exactly-once.  
> Delivery is at-least-once.  
> Side effects are at-most-once.

---

## Consumer SDK: No duplicate side effects

The consumer SDK converts delivery guarantees into **hard correctness**.

### What the SDK guarantees

- **At-most-once execution** of the handler per Idempotency-Key
- **Duplicate deliveries never re-run side effects**
- **Crash-safe behavior**: if the process crashes mid-handler, the handler is never re-entered
- **Terminal failure semantics**: if the handler throws, the idempotency row transitions to 'failed' and is never re-entered automatically
- **Transactional DB effects** for database operations performed via the provided DB client

Once a key is successfully claimed, the handler will **never** be executed again — even if the process crashes, restarts, or receives the same event repeatedly.

> Result: **side effects are never duplicated**.

---

## Exactly-once effects (clarified)

WebhookGate guarantees that your handler runs **at most once** per Idempotency-Key.

If your handler calls external systems (payments, email providers, APIs), those systems must respect idempotency keys to achieve end-to-end exactly-once effects across system boundaries.

This design deliberately favors **safety over re-execution**:

WebhookGate will never risk double-charging, double-emailing, or double-writing.

---

## Install

```bash
npm install webhookgate-sdk
```

The SDK automatically creates the required idempotency tables on first use.

---

## What the developer writes (locked API)

```js
import { idempotent } from "webhookgate-sdk";

app.post(
  "/webhooks/stripe",
  idempotent(async ({ event, db }) => {
    await chargeCustomer(event);   // never executed twice
    await sendReceipt(event);      // never executed twice
  })
);
```

There are no flags, retries, or callbacks to manage.

If safety cannot be proven, execution is refused (fail-closed).

---

## Proof & Guarantees

WebhookGate is designed to make duplicate webhook side effects structurally impossible.

For a full, reproducible proof (including crash tests and replay storms), see:
https://webhookgate.com/docs

---

## Relationship to webhook-replay

- **webhook-replay** detects unsafe handlers (local / CI)
- **WebhookGate** enforces safety in production

If `webhook-replay` reports:

```
❌ UNSAFE UNDER RETRY
```

WebhookGate is the production fix.

---

## When you need production-grade durability

Local correctness is not enough once retries, crashes, and distributed failure enter the picture.

WebhookGate adds:
- durable intake
- replay protection
- enforcement instead of best-effort guarantees

Learn more:
- Overview: https://webhookgate.com
- Technical docs: https://webhookgate.com/docs
