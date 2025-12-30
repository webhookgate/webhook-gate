# WebhookGate

WebhookGate enforces exactly-once delivery for webhooks.

It sits in front of webhook consumers and guarantees that a given event
can only be processed once, even under retries, replays, or network failure.
