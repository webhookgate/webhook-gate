# WebhookGate

WebhookGate prevents duplicate webhook processing **at the gateway layer** by providing durable webhook intake, de-duplication, and safe forwarding.

It sits in front of webhook consumers and ensures that each `(provider, eventId)` is **accepted and forwarded at most once by WebhookGate**, even under retries, replays, or noisy providers.

## What WebhookGate guarantees (MVP)

WebhookGate gives you a durable webhook “inbox” in front of your consumer:

- **Exactly-once acceptance** into WebhookGate per `(provider, eventId)`
- **De-duplication**: repeated deliveries of the same event are not forwarded again
- **Durable forwarding jobs + retries**: if downstream is temporarily down, WebhookGate retries
- **Idempotency-Key propagation** to help downstream enforce exactly-once side effects

## What WebhookGate cannot guarantee (without consumer cooperation)

No HTTP gateway can guarantee end-to-end “exactly-once effects” by itself.

If WebhookGate forwards an event and the consumer processes it, but the consumer’s 2xx response is lost,
WebhookGate cannot know whether it was processed. Retrying may produce duplicates.

**To guarantee exactly-once side effects**, the consumer must be idempotent (recommended):
- treat `Idempotency-Key` as a unique key
- atomically “check + mark processed” before applying side effects
