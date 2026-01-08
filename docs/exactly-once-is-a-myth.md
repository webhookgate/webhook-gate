# Exactly-once Delivery Is a Myth

## Why the phrase exists

“Exactly-once delivery” sounds comforting.  
It suggests:
- certainty
- correctness
- safety

Unfortunately, it does not exist in real distributed systems.

---

## The core impossibility

To guarantee exactly-once delivery, you would need:
- perfect networks
- no crashes
- no timeouts
- no partitions
- global coordination

None of those are available.

If a sender cannot distinguish:
> “the receiver processed the message”  
from  
> “the receiver processed the message but crashed before responding”

then retries are mandatory.

Once retries exist, exactly-once delivery is gone.

---

## What systems actually guarantee

Real systems offer:
- **at-least-once delivery** (webhooks, queues)
- **at-most-once delivery** (best effort, lossy)

Anything claiming exactly-once is doing one of two things:
- redefining the problem
- hiding the complexity

---

## Where confusion creeps in

Developers often conflate:
- delivery guarantees
- execution guarantees
- side-effect guarantees

A webhook may be delivered multiple times  
and still be handled safely — **but only if side effects are controlled**.

The real goal is not exactly-once delivery.

It is:

> **Exactly-once side effects.**

---

## Why this distinction matters

If you chase delivery guarantees:
- you fight the provider
- you lose to retries
- you write fragile code

If you design for idempotent side effects:
- retries become harmless
- failures become survivable
- correctness becomes provable

This is the only winning strategy.

---

## Key takeaway

Exactly-once delivery is impossible.  
Exactly-once side effects are achievable — but require architectural discipline.

---

**Canonical version:**  
https://webhookgate.com/docs/exactly-once-is-a-myth
