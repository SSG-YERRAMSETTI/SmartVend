# Database standard

Authority level 2.

## Schema

- The schema is the source of truth for structure. Constraints live in the
  database, not only in application code.
- Every table declares a primary key.
- Foreign keys are declared with explicit `ON DELETE` behavior. `CASCADE` is a
  deliberate decision, never a default chosen for convenience.
- Uniqueness that the business requires is a unique constraint, not an
  application check. Application-level uniqueness checks race.
- `NOT NULL` by default. Nullable columns must have a documented meaning for
  null, distinct from empty and from zero.
- Enumerations are constrained (native enum, lookup table, or check
  constraint), not free text.

## Types

- Money is a fixed-precision decimal with an explicit scale, plus an explicit
  currency. Never float. Never an untyped numeric.
- Timestamps are timezone-aware and stored in UTC. Column names state whether
  the value is an instant or a date.
- Every row that matters carries `created_at`, and `updated_at` when it is
  mutable.
- Identifiers are a single consistent type per project. External identifiers
  are stored in their own column, typed as text, never reused as the primary
  key.

## Ownership and tenancy

- Every tenant-scoped table carries an explicit tenant column, indexed, and
  included in the relevant unique constraints.
- Source of truth for any entity is unambiguous and documented. When data
  arrives from an external system, record the source system and the source
  identifier, and state which side wins on conflict.
- Do not create two tables that both claim to own the same fact.

## Indexes

- Index foreign keys used in joins and every column used for tenant filtering.
- Index to match the actual query patterns; review the plan rather than
  guessing.
- Remove indexes that no query uses. Every index costs writes.
- Composite index column order follows selectivity and query shape.

## Migrations

- Migrations are versioned, ordered, reviewed, and committed with the code that
  needs them.
- Every migration is tested against a realistic schema in validation.
- Expand then contract for breaking changes: add the new shape, backfill,
  migrate readers, migrate writers, then remove the old shape in a later
  release. Never in one step on a live system.
- Backfills are batched, resumable, and bounded.
- Destructive migrations (drop column, drop table, delete rows, type narrowing)
  require explicit human authorization and a stated rollback and recovery path.
  A drop is not reversible by a down migration; the data is gone.
- A migration with no rollback path is documented as such before it runs.

## Queries

- Parameterized queries only. String-built SQL is a defect.
- No unbounded `SELECT` in application paths. Paginate or limit.
- Transactions are scoped as narrowly as correctness allows and never wrap
  external network calls.
- Be explicit about isolation level where correctness depends on it.

## Access

- The application role holds the minimum privileges it needs. Schema changes use
  a separate role.
- Production data is not copied into development or test environments. Test
  fixtures are synthetic.
