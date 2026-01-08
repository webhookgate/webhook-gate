# Why Webhook Retries Cause Duplicate Side Effects

## The uncomfortable truth

Webhook providers **will** retry deliveries.  
Not sometimes. Not optionally. **Always.**

Retries happen because:
- networks fail
- servers crash mid-request
- timeouts are indistinguishable from success
- providers must assume the worst

From the provider’s perspective,  
**“no response” means “maybe failed.”**

The only safe move is to retry.

---

## What developers expect vs. what actually happens

### Expectation

> “My webhook handler runs once per event.”

### Reality

The same event can be delivered:
- multiple times
- concurrently
- out of order
- minutes or hours apart

This is not a bug.  
This is how distributed systems survive.

---

## Where duplication comes from

Duplicate side effects happen when **execution is not coupled to state**.

Typical unsafe patterns include:
- charging a customer
- sending an email
- inserting a database row
- triggering a downstream job

If your handler executes those actions **before establishing durable state**,  
every retry is a potential duplicate.

Retries don’t cause the bug.  
They **reveal** it.

---

## Why “just ignore duplicates” doesn’t work

Many teams try:
- checking event IDs in memory
- caching processed events
- trusting provider guarantees

All of these fail under:
- process restarts
- horizontal scaling
- race conditions
- partial failures

If state is not **durable and atomic**, retries win.

---

## Key takeaway

Webhook retries are unavoidable.  
Duplicate side effects are optional — but only if handled correctly.

The rest of the docs explain why common fixes fail,  
and what actually works.

---

**Canonical version:**  
https://webhookgate.com/docs/why-retries-cause-duplicates
