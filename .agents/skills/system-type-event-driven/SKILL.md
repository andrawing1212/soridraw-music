---
name: system-type-event-driven
description: "Domain patterns for event-driven and message-based systems — pub/sub, event sourcing, CQRS, sagas, delivery guarantees, schema evolution, and failure modes. Use when designing or evaluating systems built around events, messages, or asynchronous workflows."
---

# System Type: Event-Driven

Patterns, guarantees, and failure modes for event-driven and message-based architectures.

---

## Core Patterns

### Publish/Subscribe
**What it is.** Producers publish events to a topic; consumers subscribe and receive independently. Decouples producers from consumers.
**When to use.** Fan-out notifications, audit logging, updating multiple read models, cross-domain integration where the producer shouldn't know about consumers.
**When to avoid.** When you need a synchronous response. When ordering across topics matters. When the number of consumers is always exactly one (point-to-point is simpler).

### Event Sourcing
**What it is.** Store state as a sequence of immutable events rather than current-state snapshots. Current state is derived by replaying events.
**When to use.** Audit requirements (financial, regulatory). When you need to reconstruct historical state. When different consumers need different projections of the same data.
**When to avoid.** CRUD-heavy domains with simple state. When event schema evolution is harder than the audit benefit. When the team has no experience with eventual consistency patterns. When query patterns require complex joins across aggregates.

### CQRS (Command Query Responsibility Segregation)
**What it is.** Separate the write model (commands) from the read model (queries). Each is optimized for its access pattern.
**When to use.** When read and write patterns are drastically different (many reads, few writes, or vice versa). When you need different data shapes for different consumers. Pairs naturally with event sourcing.
**When to avoid.** Simple domains where read and write models are essentially the same. When the consistency lag between write and read models is unacceptable. When the operational complexity of maintaining two models exceeds the benefit.

### Saga Pattern
**What it is.** Coordinate a multi-step business process across services using a sequence of local transactions with compensating actions for rollback.
**When to use.** Business processes that span multiple services and need all-or-nothing semantics without distributed transactions.
**When to avoid.** When a single database transaction suffices. When the compensating actions are harder to implement correctly than the forward actions.

### Choreography vs. Orchestration
**Choreography:** Each service listens for events and decides independently what to do next. No central coordinator. Good for simple flows with few steps. Becomes opaque when flows are complex — the process is implicit in the event chain.
**Orchestration:** A central coordinator explicitly directs each step. Easier to understand, monitor, and modify complex flows. The orchestrator is a single point of failure and a coupling point.
**The real question:** How many steps? Fewer than 4: choreography is simpler. More than 4: orchestration is easier to reason about and debug.

## Delivery Guarantees

**At-most-once.** Fire and forget. Message may be lost. Use for: metrics, non-critical notifications, telemetry where gaps are acceptable.

**At-least-once.** Messages are retried until acknowledged. Messages may be delivered more than once. Use for: anything where losing a message is worse than processing it twice. **Requires idempotent consumers.**

**Exactly-once.** Each message processed exactly once. In distributed systems, this is achieved through at-least-once delivery + idempotent processing (not through the broker alone). Use for: financial transactions, inventory updates, anything where duplicates cause real harm.

**The practical reality:** Most systems use at-least-once delivery with idempotent consumers. Exactly-once semantics from the broker (e.g., Kafka transactions) have significant performance and complexity costs.

## Idempotency in Consumers

Every consumer in an at-least-once system must handle duplicate messages safely.

**Strategies:**
- **Idempotency key.** Store processed message IDs. Skip duplicates. Watch for: unbounded storage of processed IDs — add TTL-based cleanup.
- **Natural idempotency.** Design operations to be inherently idempotent. "Set balance to $100" is idempotent; "add $10 to balance" is not.
- **Optimistic concurrency.** Use version numbers or ETags. Reject stale updates. Works well with event sourcing.
- **Deduplication window.** Accept that duplicates outside the window may be processed twice. Appropriate when the cost of occasional duplicates is low.

## Schema Evolution

Events are contracts. They must evolve without breaking consumers.

**Backward compatible changes (safe):**
- Adding optional fields with defaults
- Adding new event types (existing consumers ignore them)

**Breaking changes (dangerous):**
- Removing fields
- Renaming fields
- Changing field types
- Changing the semantics of existing fields

**Strategies:**
- **Schema registry.** Validate compatibility at publish time. Prevents breaking changes from reaching consumers.
- **Versioned events.** `OrderPlaced.v1`, `OrderPlaced.v2`. Consumers subscribe to the version they understand. Producer may need to emit both during migration.
- **Consumer-driven contracts.** Consumers declare what fields they need. Breaking changes are detected before deployment.
- **Upcasting.** Transform old events to new schema at read time. Keeps the event store immutable while evolving the consumer's view.

## Dead Letter Queues

Messages that repeatedly fail processing go to a dead letter queue (DLQ) rather than blocking the main queue or being silently dropped.

**When to use.** Always in production systems. The alternative is losing messages or blocking processing.

**What to include.** Original message, error details, retry count, timestamp, source topic. Enough context to diagnose and replay.

**Operational requirements.** Monitoring on DLQ depth. Alerting when messages arrive. A replay mechanism to reprocess after fixing the consumer bug. Regular review — a growing DLQ is a symptom, not a solution.

## Common Failure Modes

- **Poison messages.** A single malformed message crashes the consumer repeatedly. Mitigation: retry limits + DLQ. Never retry infinitely.
- **Consumer lag.** Consumers fall behind producers. Mitigation: monitoring lag metrics, autoscaling consumers, partitioning for parallelism.
- **Ordering violations.** Messages arrive out of order. Mitigation: partition by entity ID (same entity, same partition), sequence numbers, reordering buffers.
- **Duplicate processing.** At-least-once delivery causes side effects to happen twice. Mitigation: idempotent consumers (see above).
- **Backpressure collapse.** Producers overwhelm consumers and the message broker. Mitigation: producer rate limiting, consumer scaling, broker capacity planning.
- **Split brain.** Competing consumers process the same message differently due to state inconsistency. Mitigation: single-partition-per-consumer assignment, leader election.

## Anti-Patterns

- **Event soup.** Publishing events for everything without a clear schema or purpose. Leads to undiscoverable, unmaintainable event flows.
- **Using events for synchronous queries.** Publishing an event and immediately polling for the result. Use request/response if you need a synchronous answer.
- **Fat events.** Putting entire entity state in every event. Events should carry what changed, not everything. Consumers that need full state should maintain their own projection.
- **Ignoring ordering.** Assuming messages arrive in order when the broker doesn't guarantee it for your partitioning scheme.
- **No dead letter strategy.** Silently dropping or infinitely retrying failed messages. Both are data loss — one is obvious, the other is subtle.
- **Shared event bus as integration layer.** Using one event bus for all services with no ownership model. Becomes a shared mutable dependency worse than a shared database.
