# SmartVend state

Operational handoff document. Project-owned; EVO never overwrites it. Written so
that Claude, Codex, or any future model can resume without chat history.

Not an activity log. Record what is true now and what is needed to continue.

## Project

SmartVend

## Active workstream

Platform Architecture and Seed Live Integration, owned by Angel.

Parallel workstream: Ganesh owns the SmartVend application and database
foundation, VendSoft historical migration, backend and frontend consolidation,
the VendSoft adapter, historical ETL, and historical canonical mappings. Do not
take over that work.

## Active gameplan

`docs/gameplans/SMARTVEND_PLATFORM_ARCHITECTURE_AND_SEEDLIVE_MVP.md`

Read it at the start of every session, before touching code.

## Current branch

`feat/seedlive-integration`, created from `origin/main` at
`204a4bb46bc1969704f6ea0045a9527042385a89`.

All work happens here. `main` is a baseline only: no development, no commits, no
pushes to it.

## Current milestone

Seed Live provider discovery and inbound integration boundary.

Discovery document: `docs/integrations/CANTALOUPE_SEEDLIVE_INTEGRATION.md`.

## Verified Seed Live facts

Observed in the product, recorded as project evidence:

- Delivery is configured through Reports -> Report Register -> Add Transport.
- HTTP POST is an available transport type, already used by existing VendSoft
  integrations.
- The Report Register exposes scheduling plus transport status and error
  information.
- Available reports include Single Transaction Data Export (CSV), Transaction
  Line Item Data Export, DEX File, refund reports, terminal and device reports,
  and payment reconciliation and fee reports.
- **Delivery is live only.** A configured transport sends new data. It is not a
  historical backfill mechanism, so live-provider history is a separate dataset
  from live-provider ongoing delivery.

Not verified, and therefore not implemented: authentication, HTTP wire format,
retry behavior, and whether multiple simultaneous transports are supported.

## Current state

- EVO v0.1.1 installed from source commit `6ac9f2d20f2cda8bf335d20031640cd6f6d9396a`,
  profiles `base`, `python`, `react-typescript`. Manifest integrity clean.
- Current state of the application is audited and documented. The headline
  finding is that **Supabase is still present and is the primary data path for
  most domains**, contradicting the README and SETUP.md.
- Two business-data paths coexist: React to Supabase for 11 of 19 hooks, React
  to FastAPI for 4.
- **ADR-0001 is accepted:** business data consolidates behind FastAPI and
  PostgreSQL, React to FastAPI to PostgreSQL, local PostgreSQL for development
  and RDS PostgreSQL as the intended production target. Supabase business-data
  access is legacy debt to be migrated by Ganesh's consolidation workstream, not
  an open architectural question. This workstream designs against the target and
  does not refactor those hooks. Authentication is evaluated separately.
- No Cantaloupe or Seed Live code exists. This workstream starts from nothing on
  the live-provider side.
- No automated tests anywhere on main. No CI, no AWS, no Docker.
- Alembic declared but never initialized. Three competing schema definitions.
- Validation baseline configured: frontend type check and build are required and
  pass; lint is optional and currently fails on 140 pre-existing errors.

## Completed

- VendSoft work in progress preserved on `chore/preserve-vendsoft-wip` at
  `55eed0aa66e6653a56c066b3d6926bdb595ffc94`. Do not merge it into this branch.
- Branch created from the verified latest `origin/main`.
- EVO v0.1.1 installed and verified with `evo status` and `evo doctor`.
- Current-state audit written from evidence.
- Active gameplan written, covering all 17 workstream responsibilities.
- Target architecture written and kept separate from current state.
- Project context, state, and validation configuration populated.
- ADR-0001 recorded: consolidate business data behind FastAPI and PostgreSQL.
- `data/vendsoft/raw/` and `data/vendsoft/reports/` added to `.gitignore`. They
  were unignored on main, and 34 files of real customer data were one
  `git add -A` away from being published to a public repository.

## Current implementation

`backend/integrations/`, provider-neutral and importable with no database, no
environment configuration, and no network:

- `providers.py` provider identity and live-versus-historical kind
- `connections.py` connection record, resolver interface, status rules
- `inbound.py` transport-neutral request, header allowlist, size errors
- `artifacts.py` raw artifact contract, lifecycle states, store interface
- `hashing.py` byte-exact SHA-256 and idempotency key derivation
- `connector.py` live provider connector protocol and identification result
- `ingest.py` the deterministic authenticate, hash, identify, preserve path
- `authentication.py` authenticator boundary, deny-by-default implementation

`backend/integrations/cantaloupe/`:

- `connector.py` report type registry and identification. Parsing refuses.
- `routes.py` `POST /integrations/cantaloupe/{connection_id}/reports`,
  **not registered in main.py**

Two provider assumptions were found in review and removed:

- The adapter reads **no** report-type signal from the request. Whether Seed
  Live conveys one, and where, is unverified. The provider-neutral
  `report_type_hint` field remains for an adapter with a verified source.
- Success is **200** for both a new delivery and a replay. `202` is not used
  anywhere, because whether Seed Live accepts it is unverified.

Connection-identifier enumeration was assessed and closed: every
pre-authentication rejection returns an identical `404`, and connection state
is checked after authentication. Full reasoning in section 5.1 of the discovery
document, with the requirements that must hold before route registration in
section 12.

85 backend tests, all mocked, no network, no database.

## In progress

Nothing. This checkpoint closes the discovery and boundary milestone. No parser,
no mapping, and no persistence has been written, by design.

## Blocked

1. **A real Seed Live Test Transport is required** before finalizing the
   request format, authentication, headers, report identification, retry
   behavior, and every report schema. This is the critical path and it blocks
   parsers, mappings, and registering the inbound route. The exact procedure is
   in section 10 of the discovery document.
2. **Artifact and connection persistence.** The interfaces exist; no schema has
   been created. Creating one touches the shared canonical model and requires
   coordination with the consolidation workstream plus decision D1 on schema
   authority.
3. **Application import.** `db.py` and `auth.py` raise at import time on missing
   `DATABASE_URL` and `JWT_SECRET`, and there is no `backend/.env.example`. The
   integrations package avoids that coupling, so backend tests run, but the
   application itself still cannot be started or imported here.
4. **Schema changes.** Alembic is not initialized, so there is no mechanism.
   Decision D1.

No blocker depends on Supabase. ADR-0001 settled the target, so canonical model
and live-provider contract design can proceed now.

## Next

1. **Run the Seed Live Test Transport** per section 10 of the discovery
   document: stand up a capture endpoint, configure an HTTP POST transport,
   record every configuration field and every delivered request byte for
   byte, probe retry behavior with a deliberate 500, and record the findings.
   Nothing downstream can be designed responsibly without this.
2. Implement the verified authenticator, then register the inbound route.
3. Write parsers only for report types whose schemas were captured.
4. Settle schema authority and initialize Alembic with Ganesh, decision D1,
   then create the artifact and connection persistence.
5. Agree the minimum test and CI baseline, decision D5.
6. Decide remediation for committed customer data and the exposed credential,
   decision D6.

## Known risks

1. Dual write paths to two different databases with no reconciliation. Primary
   architectural risk. The target is settled by ADR-0001; the risk persists
   until the consolidation migration completes.
2. Compromised credential in public Git history at `4879cf5`. Treat as
   compromised; rotation is a human action and is still outstanding.
3. Customer data committed to a public repository: a PostgreSQL dump, seed
   spreadsheets with real site names, and real receipt images.
4. No tests and no CI, with two engineers working in parallel.
5. Documentation actively misleads. The README describes a stack that does not
   exist. Trusting it produces wrong designs.
6. Schema ambiguity across three definitions with no migration tooling in use.

## EVO compatibility findings

Recorded here, not patched. EVO-owned files were not modified.

1. **EVO needs a first-class active-gameplan declaration and session-start
   requirement.** EVO 0.1.1 has `[docs] authoritative` in project config, which
   is close but not the same thing: it lists authoritative documents without
   designating one as the active plan, and nothing in the session-start
   procedure requires reading it. The gameplan pointer currently lives in
   `context.md`, `state.md`, and first in the `authoritative` list, by
   convention rather than by mechanism.
2. **Profile selection has no way to express "needed soon".** The `aws` profile
   was not enabled because current main contains no AWS evidence, which is the
   correct rule, yet this workstream owns AWS architecture. Adding it later is
   one `evo sync --profiles` away, so this is minor.

Neither blocks the workstream. Both are candidates for a later EVO fix branch.

## Last updated

2026-08-12T03:40:00Z
