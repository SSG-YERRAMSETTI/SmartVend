# ADR-0001 Consolidate SmartVend business data behind FastAPI and PostgreSQL

- Status: Accepted
- Date: 2026-08-12
- Supersedes: none

## Context

The current-state audit at `origin/main` commit
`204a4bb46bc1969704f6ea0045a9527042385a89` established that SmartVend has two
independent business-data paths:

- **React to Supabase, directly.** 11 of 19 frontend hooks read and write
  through `src/integrations/supabase/client.ts`, covering machines, locations,
  inventory, sales, routes, telemetry, reports, dashboard, admin, audit logs and
  API keys. 18 files import the client; 145 Supabase references exist under
  `src/`. A Supabase project lives in `clouddata/` with 8 SQL migrations and a
  Deno edge function.
- **React to FastAPI to PostgreSQL.** 4 hooks: `useApi`, `useProfitAnalytics`,
  `useRestockRecommendations`, `useWarehouseInventory`.

Two paths writing to two different databases with no reconciliation is the
primary architectural risk in the system. It also makes a provider-neutral
canonical model impossible to define, because no single store owns domain data.

`README.md`, `SETUP.md`, and `backend/schema.sql` all already assert that
Supabase was removed. That assertion is false as of the audited commit, but it
reflects the intended direction.

The onboarding platform depends on this being settled. Historical migration and
live provider ingestion both terminate in the canonical model, and that model
must live somewhere definite.

## Decision

**SmartVend business data does not use Supabase as an operational data path.**

The target application path is:

```
React  ->  FastAPI  ->  PostgreSQL
```

- No direct frontend business-data access to Supabase.
- Development runs against local PostgreSQL.
- Amazon RDS PostgreSQL is the intended production deployment target. This is a
  target, not current verified infrastructure: no AWS resource, account, or
  infrastructure-as-code exists in the repository today.

Current direct Supabase business-data access is **legacy technical debt to be
migrated**, not an unresolved architectural option.

**Authentication is evaluated separately.** The audit found that authentication
already runs through FastAPI, using PyJWT with HS256 and passlib bcrypt, while
the Supabase client remains configured to persist sessions in `localStorage`.
Whether any Supabase auth session is still established is unverified. The
continued presence of Supabase data access is not a reason to keep Supabase
Auth, and no decision on the auth mechanism is implied by this ADR.

## Ownership

- **Ganesh** owns the application and backend consolidation implementation:
  migrating the frontend hooks off Supabase, consolidating the FastAPI surface,
  and the schema work that follows.
- **Angel** designs the canonical model and the live-provider contracts against
  this target architecture. Angel's branch does not refactor the existing
  frontend hooks.

## Consequences

- The canonical model and all live-provider contracts are designed against
  FastAPI and PostgreSQL. The legacy Supabase path is never a design input.
- New work does not add Supabase usage. Any new business-data access goes
  through FastAPI.
- Existing Supabase code remains in place until the consolidation workstream
  migrates it. Its presence in the repository is expected and is not a defect to
  be fixed opportunistically by whoever notices it.
- Removing Supabase eventually requires migrating the data held in the Supabase
  project, retiring the edge function, and reconciling the three competing
  schema definitions. That sequencing belongs to the consolidation workstream.
- Documentation that already claims Supabase was removed becomes accurate only
  when the migration completes. Until then the current-state audit is the
  authority on what actually exists.
- Production deployment on RDS requires an AWS decision that has not been made.
  This ADR fixes the database technology and the access path, not the hosting.

## Revisit if

PostgreSQL proves unable to serve a requirement that Supabase uniquely met, such
as a realtime subscription feature with no practical FastAPI equivalent. That
would need a new ADR superseding this one, not an informal exception.
