# Backend patterns

Authority level 2. Proposed Evolium standard patterns. These are patterns, not a
description of any existing Evolium system.

## Layering

Three layers, one direction of dependency:

```
transport (HTTP handler, queue consumer, CLI)
    -> domain (business rules, entities, invariants)
        -> adapters (database, external APIs, storage, messaging)
```

- Transport parses and validates input, resolves identity, and translates domain
  results into protocol responses. It contains no business rules.
- Domain contains the rules. It does not import a web framework, an ORM session,
  or an SDK client.
- Adapters implement interfaces the domain declares. Swapping an adapter must
  not change domain code.

The purpose is testability: the domain can be tested without I/O, and adapters
can be tested against the real boundary.

Do not build this scaffolding for a service that has no business rules. A thin
CRUD service is allowed to be thin.

## Boundaries

- One module owns one concept. Two modules that must change together are one
  module.
- Cross-module access goes through a declared interface, not through reaching
  into internals.
- Shared code that only exists to avoid duplication between two unrelated
  features usually creates coupling that costs more than the duplication.

## Configuration

- Configuration is read once at startup, validated, and passed explicitly.
  Reading environment variables deep in the call stack hides dependencies.
- Fail fast on invalid or missing configuration. Do not start with a default
  that silently disables a security control.
- Configuration is typed and documented. Secrets come from the secret store.

## Errors

- Domain errors are typed and meaningful. Transport maps them to protocol
  responses in one place.
- Unexpected errors are logged with context and returned as a generic response
  with a correlation identifier. Internal detail never reaches the client.

## Asynchronous work

- Work that can fail independently, take long, or must survive a restart goes to
  a queue, not a background thread.
- Consumers are idempotent, because delivery is at-least-once.
- Every consumer has a dead-letter destination and a documented replay
  procedure.
- Message schemas are versioned. Consumers tolerate unknown fields.

## External calls

- Every outbound call: explicit timeout, bounded retries with backoff for
  idempotent operations only, and a defined failure behavior.
- Isolate a failing dependency so it cannot exhaust the whole service.
- Never hold a database transaction open across a network call.

## State

- Prefer stateless services. Session state belongs in a store, not in process
  memory.
- Caches declare their invalidation rule before they are added. A cache without
  an invalidation story is a future defect.
