# Multi-tenant systems

Authority level 2. Patterns for systems serving multiple customers from shared
infrastructure.

## Tenant identity

- Tenant identity is resolved once, at the authentication boundary, from the
  authenticated principal.
- It is never taken from a request body, query parameter, header, or path
  segment supplied by the client.
- It is carried explicitly through the call stack or through a request-scoped
  context that cannot be silently absent. A default of "no tenant" that means
  "all tenants" is a critical defect.

## Isolation model

State the model explicitly per system:

- **Shared schema, tenant column** cheapest, highest risk of a missing filter.
  Requires enforcement at the data access boundary and negative tests.
- **Schema or database per tenant** stronger isolation, higher operational cost,
  migration complexity grows with tenant count.
- **Account or cluster per tenant** strongest, reserved for requirements that
  justify it.

Do not mix models within one dataset without documenting why.

## Enforcement

- Filtering by tenant happens in one enforced place: a repository layer, a query
  builder, or database row-level security. It must not depend on every future
  caller remembering.
- Cross-tenant operations are an explicitly modeled capability, separately
  authorized and audited. They are never a side effect of an admin flag.
- Background jobs, migrations, exports, and admin tools are the most common
  isolation leaks. They carry tenant scope like any other path.
- Caches, rate limiters, idempotency keys, and search indexes are keyed by
  tenant. A shared cache key across tenants is a data leak.

## Data lifecycle

- Tenant deletion and export are designed, not improvised. Know every store
  holding tenant data, including logs, backups, caches, and analytics.
- Backups and restores are tenant-aware where a single-tenant restore is a
  requirement.

## Noisy neighbors

Per-tenant quotas and rate limits. One tenant must not be able to exhaust a
shared resource. Monitor per tenant, not only in aggregate.

## Observability

Tenant identifier on logs, metrics, traces, and cost attribution, so failures
and spend can be attributed. Never place tenant PII in a metric label or a
correlation identifier.

## Testing

Every tenant-scoped feature has a negative test proving tenant A cannot read or
modify tenant B's data, exercised through the real access path. This test is
required, not optional.
