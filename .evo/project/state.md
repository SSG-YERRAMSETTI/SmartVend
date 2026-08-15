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

ClickUp Task 1, MVP canonical business model, 2026-08-14. **Architecture and
documentation only; no models, no schema, no migrations.**

`docs/architecture/ADR-0003-mvp-canonical-business-model.md` records the
decisions; `SMARTVEND_TARGET_ARCHITECTURE.md` §3.1 carries the MVP ER diagram.

**Approved unchanged:** Organization, User, Location, Machine, Product, Slot.
`Machine.location_id` and `Slot.product_id` stay nullable, both already
supported by working behavior.

**Changed from the 1A proposal:** the existing `sales` table is **not** the
canonical transaction model. It has zero backend readers or writers, is
consumed only through the legacy Supabase path, holds one product per row with
no header, models no refund, carries no external identity, and has no
uniqueness constraint. Verified Seed Live evidence shows one provider
transaction may carry multiple items. The target is two-level:
**`VendTransaction` -> `VendTransactionLine`**, with `slot_id` and `product_id`
nullable so an unresolved selection never causes a business event to be
discarded. The header carries **`total_amount`**, and lines are **`0..N`**, so a
monetary event stays representable when line detail is missing; a synthetic
"unknown" line is never fabricated to satisfy cardinality. Refunds are
`transaction_type = REFUND` with a positive `total_amount`, typed and never
signed, so net revenue must branch on type rather than rely on sign. Where lines
exist, their sum may be compared to `total_amount` as a control, but is not
authoritative over the header.
`sales` is classified legacy compatibility and is not deleted, migrated, or
modified.

**Not implemented, deliberately:** no SQLAlchemy or schema change, no
migration, no routes, no repositories, no write port, no parsers.

Preceded by the ownership-field alignment, 2026-08-14. **Name-only rename; no
behavior change, no persistence.**

**CURRENT:** the integration layer now uses **`org_id`** as the concrete
SmartVend ownership identifier, on `IntegrationConnection`, on
`RawReportArtifact`, and as the `idempotency_key` parameter.

**ARCHITECTURAL TERM:** **`tenant`** remains the general multi-tenancy and
security concept, and stays in prose, docstrings, and test names describing
isolation. Only concrete fields moved. See ADR-0002 D1a.

The idempotency derivation is **byte-identical**. Only values are hashed, never
field names, so no key changed. `test_hashing.py` pins the SHA-256 digest of
fixed inputs to a literal computed *before* the rename, so any future change to
the derivation fails loudly. The ownership **value source is unchanged**: it
still comes from the resolved connection and never from payload content.

`org_id` remains a `str` in this package, deliberately, so the integration layer
stays free of database coupling. Two deferrals are recorded in code where they
will be needed:

- **UUID canonicalization** (`hashing.py`). `organizations.id` is UUID-backed.
  When `org_id` starts coming from it, the repository adapter must canonicalize
  the value, or two spellings of the same UUID will hash to different keys and
  silently defeat replay detection.
- **Artifact org scoping** (`artifacts.py`). `find_by_idempotency_key` is
  hash-keyed. A SQL implementation must also filter on `org_id`, so ownership
  does not rest solely on the scope embedded in a hash.

Preceded by D1 integration persistence boundary, 2026-08-14. **Architecture and
documentation only; no persistence contracts implemented.**

- `docs/architecture/SMARTVEND_INTEGRATION_ARCHITECTURE_GUIDE.md` explains the
  terminology and mental model in plain English. Read it before the ADRs.
- `docs/architecture/ADR-0002-integration-evidence-persistence-boundary.md`
  records the decisions.

**ADR-0002 decisions.** Tenant is the architectural concept, **Organization**
is SmartVend's representation, and **`org_id` -> `organizations.id`** is the
persistence identity. No second Tenant entity. The blanket rule that every
tenant-scoped table carries a tenant column is **superseded**: control-plane
roots carry explicit organization ownership, subordinate records may inherit it
through a mandatory parent relationship, and organization context never derives
from payload content. A canonical application **write port** is defined as a
rule and **deliberately not designed**, because no service or repository layer
exists in the application to design against. External identity uses a generic
crosswalk with initial uniqueness `(connection_id, entity_type, external_id)`
and mapping states UNRESOLVED, RESOLVED, AMBIGUOUS.
`Machine.external_code` and `Machine.telemetry_device_id` are classified
**PRE-EXISTING COMPATIBILITY FIELDS**, untouched, and require a consumer
inventory before any deprecation decision.

**Follow-up completed** by the ownership-field alignment below.

Preceded by the Seed Live authentication boundary, 2026-08-14: HTTP Basic
implemented behind the existing inbound boundary; route still unregistered.
Details under "Current implementation".

Preceded by Seed Live provider discovery, sessions 2026-08-12 and 2026-08-13,
covering the Test Transport wire contract and the first transaction-level
dataset.

Discovery document: `docs/integrations/CANTALOUPE_SEEDLIVE_INTEGRATION.md`.
Section 1A holds the Test Transport evidence; section 1B holds the
transaction-level evidence and the provisional transaction contract in 1B.1.

Six genuine Seed Live deliveries were captured through a temporary Cloudflare
tunnel into a standalone harness, `scripts/seedlive_capture.py`. Raw evidence is
under `data/seedlive/`, gitignored, never to be committed. The tunnel and
listener have been shut down.

**Resolved:** authentication is HTTP Basic via the transport's Username and
Password fields; no `Content-Type` or `Content-Disposition` is sent on a Test
Transport; HTTP 200 is accepted as success.

**Explicitly NOT verified:**

- **How a real delivery identifies its report.** A Test Transport appends the
  literal segment `testTransportFileName`, adds `reason=TEST`, and sends no
  report-type header. None of that establishes the real contract. Whether a
  real report appends its actual filename, whether such a filename identifies
  the report type, and whether report type is conveyed anywhere else on a real
  delivery are all open. Do not generalize Test Transport behavior into the
  real delivery contract.
- **That multiple transports can coexist.** A pair of deliveries 0.217s apart
  is proven to be two distinct HTTP requests, but their origin is not
  established. Two transports causing it is inference only.
- **Retry behavior on a real delivery.** Untested. See below for what a Test
  Transport does. The four identical successful deliveries were distinct HTTP
  requests, all received HTTP 200, and their payloads were byte-identical;
  whether any were provider retries, duplicate Test Transport executions, or
  another internal Seed Live behavior is not established.

**Test Transport failure behavior. VERIFIED 2026-08-14.** Controlled 500
experiment, discovery document section 1A.1. Seed Live UI immediately showed
`Transport Status: Invalid` and
`Failure: TransportException:POST Request was not successful: 500 -`. Exactly
one request arrived, and **no automatic retry occurred within a window
exceeding three minutes**, on a listener armed to return 200 to any second
request. The transport did not recover on its own. The failing request was
otherwise identical to every prior Test Transport, same path, same
`reason=TEST`, byte-identical 33-byte payload.

**NOT VERIFIED for real generated report deliveries:** whether a 500 triggers a
retry, retry count, interval or backoff, whether 5xx is preferable to 4xx, and
whether real delivery uses the same HTTP client behavior as Test Transport. A
Test Transport posts a fixed synthetic string and does not exercise report
generation.

**This does not justify changing `BACKEND_UNAVAILABLE_STATUS_PROVISIONAL`.**
The provisional 404 exists to preserve enumeration protection, and the case
against it rests on real-delivery retry semantics, which remain unmeasured. The
production response policy for an authentication-backend outage stays
unresolved.

**Not obtained:** any real report delivery **over a transport**. Registering
`Single Transaction Data Export` against the transport produced only Test
Transports, which send a fixed 33-byte string and do not exercise report
generation. The schema of a **delivered** report, and everything about the real
delivery wire contract, remains unknown.

This is distinct from the transaction-level schema recorded below, which came
from a **UI export**, not a transport delivery. Do not assume the two are the
same shape.

**Account activity: VERIFIED 2026-08-13.** The account holds real transaction
history. Evidence via **Build a Report -> Simple Report**: activity is visible
in **September 2025**, **2025-09-26** is confirmed active with non-zero
transaction amounts, and the report spans **11 pages**, so this is not an empty
or non-production account. The Simple Report is aggregated by day and payment
type and is **not** sufficient for transaction-level migration or schema
discovery.

This explains the two earlier empty exports rather than contradicting them:
both sampled **2026** dates, and the activity is in **2025**. The exports were
not faulty and the transport was not at fault, the date ranges were wrong for
this account. **Every future discovery export must target a confirmed-active
period**, starting with 2025-09-26.

**Transaction-level evidence obtained. VERIFIED 2026-08-13.** Via
**Reports -> Payments -> Transactions in Payment -> historical payment batch**,
exported as CSV. 16 columns, 1,586 rows, 2025-09-19 to 2025-09-26, flat and
uniform. The CSV carries four columns the UI did not display. Full analysis and
classifications in discovery document section 1B; a provisional
provider-neutral transaction contract is in 1B.1.

Tightened classifications that must not be loosened without new evidence:

- `Tran #` is unique **within this export only**. Global uniqueness across Seed
  Live history, operators, and accounts is **NOT VERIFIED**. It is the leading
  provider transaction external-ID candidate, **not a proven global natural
  key**.
- Device-to-Terminal 1:1 holds **within this export only**. That it holds across
  the operator's history is **NOT VERIFIED**.
- `AP Code` is populated on non-cash rows and blank on cash rows, with high
  uniqueness. Payment or authorization relation is **INFERRED**. Exact
  semantics, whether it is an authorization identifier, and whether it is stable
  or reusable as an external identity are **NOT VERIFIED**. **Do not build an
  AP-code identity model.**
- `Details` tokenizes deterministically into 134 short code-like tokens with
  prices and quantities. Vending selection identifiers is **INFERRED**. MDB
  selection numbers, planogram slot IDs, and product IDs are **NOT VERIFIED**.
  **Do not call them MDB codes. Do not finalize the selection crosswalk until
  planogram or product evidence exists.**
- Whether the CSV export covers all four UI pages is **NOT VERIFIED**. Only the
  1,586 rows across the observed range are established. Row count alone proves
  nothing about page coverage.
- Timezone and currency are absent from the data and **cannot be derived from
  it**.

No schema and no migration follows from this yet.

**UI capability survey. VERIFIED 2026-08-13. Discovery on this account is
closed.** Full detail in discovery document section 1C.

Administration exposes only W-9, Complete Order, Refunds, Regions, and Campus
Cards, with **no device, machine, product, planogram, coil, selection, or
inventory configuration**. Device Management offers RMA and transfer only.
Configuration offers no product, planogram, or selection management. DEX Status
returned no data for the known-active September 2025 period. Payments is the one
productive source. Sprout Transaction Line Item Data Export advertises
`Coil Name`, `Price`, and `Quantity`, but **this dormant account has no Daily
Export batch available to produce a sample**.

Consequently:

- Selection to product resolution: **NOT VERIFIED**
- `Details` short codes: **INFERRED** likely selection identifiers only
- `Coil Name`: **VERIFIED** as an advertised Sprout export field, **NOT
  VERIFIED** against the `Details` short codes. They are not shown to be the
  same thing
- MDB interpretation: **NOT VERIFIED**

**This account cannot provide enough evidence to complete the selection and
product mapping.** Do not keep probing unrelated Seed Live UI areas.

Resolution requires one of: a currently active Seed Live account producing
Sprout Transaction Line Item Data Export; a provider-supplied sample or file
specification; a planogram or product export from Cantaloupe / Seed Live; or
another authorized customer account with usable line-item history.

**Sent Reports history does not cover that period. VERIFIED 2026-08-13.**
`Reports -> Report Register -> Transactions Included in EFT (<operator>)
-> Filter By: User Report -> 09/01/2025 through 10/15/2025` returned
**"No data found"**. This proves only that the *Sent Reports history* holds no
retrievable file for that window. It does **not** prove the underlying EFT data
did not exist. Consequence: retrieving an already-sent file is not a route to
the September 2025 transaction-level schema; a report will have to be generated
over that period instead.

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

Superseded in part by the Test Transport session above, which verified the
authentication mechanism and the wire shape **of a Test Transport**. Everything
about a **real** delivery remains unverified: report identification, whether
`Content-Type` is set, the filename convention, the report schema, retry
behavior, and whether multiple simultaneous transports are supported.

Verified does not mean implemented. Nothing about authentication has been built.

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

**Authentication implemented 2026-08-14.**

- CURRENT IMPLEMENTATION: HTTP Basic authenticator implemented and tested
  offline. `BasicAuthenticator` in `authentication.py` implements HTTP Basic
  authentication compatible with the verified Seed Live Test Transport behavior
  and RFC 7617 framing, with SmartVend policy requiring UTF-8 credentials and a
  non-empty username and password. This is deliberately stricter than the RFC,
  which leaves the charset undefined and permits an empty password, so it is
  not a claim of standards equivalence. It
  verifies against a per-connection credential resolved from `credential_ref`
  through the `CredentialProvider` contract in `credentials.py`. Username and
  password are both compared with `hmac.compare_digest`, and both comparisons
  always run.
- PROVIDER EVIDENCE: HTTP Basic verified from a Seed Live **Test Transport**.
- LIMIT: real generated-report authentication behavior remains **NOT
  VERIFIED**. No real delivery has ever been captured.
- ROUTE STATUS: **still unregistered**.

Fails closed on every path, and a connection with no credential configured
fails exactly like a wrong password, so an unauthenticated caller cannot learn
whether a credential reference exists.

- INTERNAL FAILURE CLASSES: caller authentication failure and authentication
  infrastructure failure remain **distinct**. `AuthenticationFailed` covers a
  bad or missing header, wrong credentials, and unusable credential
  configuration. `AuthenticationBackendUnavailable` covers an unreachable
  secret store or any backing service failure. The latter is **not** a subclass
  of the former and is never converted into it, so an outage stays visible in
  logs, metrics, and any future retry policy rather than being counted as an
  attack. Backend failures log at `error`, caller failures at `warning`.
- NOT VERIFIED: **what HTTP response Seed Live should receive when our
  authentication backend is temporarily unavailable.** The public mapping is
  currently the same `404` as every other pre-authentication outcome, which
  preserves enumeration protection but is the wrong retry signal. It is marked
  **PROVISIONAL** in one place,
  `BACKEND_UNAVAILABLE_STATUS_PROVISIONAL` in `cantaloupe/routes.py`, and waits
  on the deliberate Seed Live failure and retry test. **404 is not the final
  answer here.**

No secret store is wired. AWS Secrets Manager is the production direction and is
deferred; the credential provider dependency fails closed and tests use an
in-memory fake. No database schema changed.

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

143 backend tests, all mocked, no network, no database, no AWS.

## In progress

Nothing. This checkpoint closes the discovery and boundary milestone. No parser,
no mapping, and no persistence has been written, by design.

## Blocked

1. **No real Seed Live report delivery has been obtained.** The Test Transport
   session is complete and resolved authentication and the wire shape, but a
   Test Transport sends a fixed synthetic string and never exercises report
   generation. The real filename convention, the production `reason` value,
   `Content-Type` on a real delivery, retry behavior, and every report schema
   remain unknown. This still blocks parsers, mappings, and registering the
   inbound route.

   The earlier obstacle, whether the account holds any history at all, is
   **resolved**: activity is confirmed in September 2025. See discovery
   document section 10A. Discovery exports must target that period, not recent
   dates.
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

Discovery on this account is closed. The next steps split into implementation
that verified evidence already supports, and external dependencies that no
amount of further probing here will resolve.

**Implementation, on verified evidence:**

1. ~~Implement the HTTP Basic inbound authenticator.~~ **Done 2026-08-14.**
2. A **provider-neutral `Details` tokenizer** as a pure parsing utility.
   Deterministic tokenization is verified; the tokens stay unresolved and are
   not mapped to products. Deliberately excluded from the authentication
   milestone.

**External dependencies, blocking and not resolvable here:**

3. Selection to product mapping, requiring one of the four options above.
4. **Timezone** Seed Live uses for report timestamps, from account settings or
   provider documentation. The data cannot answer it.
5. The real **delivery wire contract**, which needs a live delivery on an active
   account.
6. Whether single-location and single-asset is a property of the account or of
   that payment, and whether the CSV export covers all UI pages.
3. Implement the Basic authenticator, then register the inbound route, subject
   to the requirements in discovery document section 12.
4. Write parsers only for report types whose schemas were captured.
5. Settle schema authority and initialize Alembic with Ganesh, decision D1,
   then create the artifact and connection persistence.
6. Agree the minimum test and CI baseline, decision D5.
7. Decide remediation for committed customer data and the exposed credential,
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

2026-08-14T05:00:00Z
