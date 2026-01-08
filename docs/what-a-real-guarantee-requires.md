# What a Real Guarantee Requires

## What “safe” actually means

A real guarantee must survive:
- retries
- concurrency
- crashes
- restarts
- partial failures

Anything less is not a guarantee — it’s optimism.

---

## The minimum requirements

To prevent duplicate side effects, a system must:

### 1. Establish durable state before executing effects
- The system must remember what it has seen
- Memory is not enough
- Logs are not enough

### 2. Bind execution to that state atomically
- Either the effect happens *and* state updates
- Or neither happens
- No in-between

### 3. Reject or short-circuit replays deterministically
- Every retry must hit the same decision point
- No timing-based logic
- No best-effort checks

### 4. Operate outside application process memory
- Processes crash
- Containers restart
- Horizontal scaling is normal

---

## Why middleware alone fails

Most webhook handlers run:
- inside web servers
- behind frameworks
- with business logic interleaved

This makes it extremely hard to:
- reason about atomicity
- guarantee ordering
- control execution boundaries

Idempotency bolted onto handlers is fragile by default.

---

## Where a gateway fits

A gateway sits **before** application logic and:
- absorbs retries
- deduplicates events
- establishes durable intake state
- controls execution flow

This is not an implementation detail.  
It is a **boundary decision**.

Once retries pass into business logic, safety is already compromised.

---

## What WebhookGate guarantees

WebhookGate guarantees:
- no duplicate side effects for the same webhook event
- regardless of retries, concurrency, or crashes

WebhookGate does **not**:
- promise exactly-once delivery
- fix unsafe downstream code
- run business logic for you

It enforces the boundary that makes safety possible.

---

## What to do next

If webhook failures matter in production:
- read how teams integrate WebhookGate
- evaluate it in a pilot
- test it against real failure modes

Understanding the problem is step one.  
Eliminating it requires a system designed for reality.

---

**Canonical version:**  
https://webhookgate.com/docs/what-a-real-guarantee-requires
