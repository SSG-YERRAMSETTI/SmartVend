# API design standard

Authority level 2. Applies to HTTP APIs Evolium exposes or consumes.

## Contract

- The contract is explicit and machine-readable (OpenAPI or an equivalent the
  project declares). The contract is versioned with the code.
- Resource-oriented paths, plural nouns, no verbs in paths. Actions that are not
  CRUD are modeled as sub-resources or explicit command endpoints.
- Breaking changes require a new version. Additive, optional fields are not
  breaking. Removing a field, changing a type, tightening validation, or
  changing default behavior is breaking.
- Consumers are enumerated before a breaking change ships.

## Requests

- Validate every request against an explicit schema at the boundary. Reject
  unknown fields when strictness matters; document the choice.
- Never accept tenant identity, user identity, role, or price from the client
  when the server can derive it. Client-supplied identity is an authorization
  defect.
- Enforce request size limits and field length limits.

## Status codes

- `200` success with body, `201` created with a location, `202` accepted for
  async work, `204` success with no body.
- `400` malformed or failing validation, `401` unauthenticated, `403`
  authenticated but not permitted, `404` not found or not visible to this
  caller, `409` conflict, `422` semantically invalid, `429` rate limited.
- `500` unexpected server fault, `502`/`503`/`504` upstream faults.
- Do not return `200` with an error payload. Do not return `500` for client
  input errors.

## Errors

- One error shape across the API: a stable machine-readable code, a human
  message, and a correlation identifier.
- Error messages never leak stack traces, SQL, internal hostnames, credentials,
  or another tenant's data.
- `404` rather than `403` when revealing existence would leak information.

## Idempotency and retries

- `GET`, `PUT`, `DELETE` are idempotent. `POST` that creates or moves money
  accepts an idempotency key and returns the original result on replay.
- Document retry semantics per endpoint: what is safe to retry and what is not.
- Server-side deduplication is required where the client is a third party or a
  webhook.

## Pagination and filtering

- Any collection that can grow is paginated from the first version. Adding
  pagination later is breaking.
- Prefer cursor pagination for large or mutating datasets. Document ordering;
  pagination without a stable sort is incorrect.
- Declare maximum page size and enforce it.

## Authentication and authorization

- Authenticate every endpoint. Public endpoints are an explicit, documented
  exception list.
- Authorize per resource, not only per route.
- Tenant isolation is enforced at the data access boundary. See
  `constitution/security.md`.

## Operational behavior

- Every endpoint has a timeout budget. Every outbound call it makes has a
  shorter one.
- Rate limits are declared and return `429` with retry guidance.
- Correlation identifiers propagate inbound to outbound. See
  `standards/observability.md`.
- Long-running work returns `202` with a status resource rather than holding the
  connection.

## Compatibility testing

Contract tests run in validation. A change to the contract without a
corresponding contract test update is a defect.
