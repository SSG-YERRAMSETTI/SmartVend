# SmartVend Platform Architecture and Seed Live MVP

Authoritative engineering gameplan for the Angel workstream.

Labels used throughout: **CURRENT** for verified present state, **TARGET** for
intended design, **DECISION NEEDED** for an open question that requires a human
and an ADR before implementation.

- Owner: Angel
- Branch: `feat/seedlive-integration`
- Baseline: `docs/architecture/SMARTVEND_CURRENT_STATE_AUDIT.md`, audited at
  `204a4bb46bc1969704f6ea0045a9527042385a89`
- Target design: `docs/architecture/SMARTVEND_TARGET_ARCHITECTURE.md`
- Last updated: 2026-08-12

## 1. Purpose

Build the platform layer that lets SmartVend onboard a vending operator from
their existing technology ecosystem, and keep live operational data flowing
afterwards.

Two classes of external system must be supported and they are different
concerns:

- **Historical migration sources** such as VendSoft, other VMS platforms, CSV,
  Excel, and portal exports. These load a finite history once.
- **Live operational providers** such as Cantaloupe / Seed Live and Nayax. These
  keep delivering after SmartVend replaces the previous VMS.

Both terminate in one provider-neutral SmartVend canonical model.

## 2. Workstream scope

The 17 responsibilities owned by this workstream:

1. Finalize the canonical data model and approve entity relationships
2. Define tenant isolation, external identity mapping, connection records,
   source artifacts, and onboarding run models
3. Own the Cantaloupe / Seed Live investigation and integration
4. Document Seed Live report types, transport options, schemas, frequencies, and
   delivery behavior
5. Build the SmartVend inbound endpoint for Seed Live reports
6. Implement raw payload preservation and report version handling
7. Implement transaction, line-item, device, refund, and selected report parsers
8. Build telemetry device to SmartVend machine mappings
9. Build provider selection code to machine-slot and product mappings
10. Implement queue-backed live ingestion with SQS where appropriate
11. Design and implement connection health, retries, failures, and monitoring
12. Define the generic Live Provider Connector SDK for Nayax and future providers
13. Design the Master Onboarding Orchestrator
14. Implement Bedrock-assisted dataset identification, mapping suggestions, gap
    analysis, and next-action recommendations
15. Define deterministic reconciliation and Migration Coverage Manifest rules
16. Own AWS architecture for S3, SQS, Secrets Manager, RDS, Step Functions, and
    CloudWatch where used
17. Lead security review, architecture review, final integration acceptance, and
    pilot cutover

## 3. Out of scope

- VendSoft adapter implementation and historical ETL. Ganesh owns this.
- The existing SmartVend application UI and its current CRUD features.
- Backend and frontend consolidation of the current dual data path, except for
  the architectural decision itself, which is shared.
- Retiring Supabase. This workstream depends on the decision but does not
  execute the migration.
- Any change to the preserved branch `chore/preserve-vendsoft-wip`.

## 4. Relationship to the SmartVend Onboarding Platform MVP

This workstream is the platform half of the wider MVP. The MVP as a whole must
prove SmartVend can identify a customer's systems, migrate history, establish a
live integration, normalize both into one canonical model, preserve raw
evidence, map external identities without adopting external primary keys,
validate completeness deterministically, produce a Migration Coverage Manifest,
track onboarding and connection health, and require human approval before
cutover.

First supported combination: **historical VendSoft, live Cantaloupe / Seed
Live.** The architecture must admit further providers without redesign.

## 5. Relationship to the parallel workstream

Ganesh owns the SmartVend application and database foundation, VendSoft
historical migration, FastAPI and frontend consolidation, the VendSoft adapter,
historical ETL, historical canonical mappings, and migration application
support.

The convergence point is the canonical model and the shared framework
abstractions: external identity, connection records, source artifacts, and
onboarding runs. Those are defined in this workstream and consumed by both.

Coordination rule: neither workstream changes the other's area without an
explicit agreement recorded as an ADR. The canonical model is a shared contract
and changes to it require both owners.

## 6. Verified current-state baseline

Full detail in the current-state audit. What matters for this workstream:

- **CURRENT** Two business-data paths exist. 11 of 19 frontend hooks read and
  write through Supabase directly; 4 go through FastAPI. Core domains, machines,
  locations, inventory, sales, routes and telemetry, bypass the backend today.
- **CURRENT** Supabase is still heavily present and in use, contradicting the
  README, SETUP.md, and `backend/schema.sql`, which all claim it was removed.
- **CURRENT** No Cantaloupe, Seed Live, or Nayax code exists. This workstream
  starts from nothing on the live-provider side.
- **CURRENT** VendSoft code is not on main; it is preserved on a separate branch.
- **CURRENT** No tests, no CI, no AWS, no Docker, no infrastructure-as-code.
- **CURRENT** Alembic is declared but not initialized. Three competing schema
  definitions exist, none authoritative.
- **CURRENT** Authentication runs through FastAPI with JWT and bcrypt, while the
  Supabase client remains configured to persist sessions.

### 6.1 Supabase: accepted target decision

Settled by **ADR-0001**, `.evo/project/decisions/`. Not an open question.

- **CURRENT.** Supabase is the primary business-data path for most domains.
- **TARGET.** SmartVend business data does not use Supabase as an operational
  data path. The application path is **React to FastAPI to PostgreSQL**, with
  local PostgreSQL for development and Amazon RDS PostgreSQL as the intended
  production target. RDS is a target, not current verified infrastructure.
- Current direct Supabase business-data access is **legacy technical debt to be
  migrated**, not an architectural option still under consideration.
- **Authentication is evaluated separately.** The continued presence of Supabase
  data access is not a reason to keep Supabase Auth. No auth decision is implied.

**MIGRATION CONSTRAINT.** Ganesh owns the application and backend consolidation
workstream. This branch does **not** refactor the existing frontend hooks, does
not remove Supabase code, and does not migrate the Supabase-backed domains. Any
such change here would collide with the parallel workstream.

**SHARED DEPENDENCY.** Angel's canonical model and all live-provider contracts
are designed against the **target** FastAPI and PostgreSQL architecture. The
legacy Supabase data path is never a design input. This means canonical model
work is not blocked by the state of the migration: the target is known, so the
contracts can be defined now.

## 7. Architectural principles

Accepted and binding for this workstream.

1. **One connector implementation per provider, many connections per customer.**

   ```
   CantaloupeConnector
       + Customer A connection
       + Customer B connection
       + Customer C connection
   ```

   Hundreds of customers means hundreds of connection records, never hundreds of
   connector implementations. Customer-specific behavior lives in configuration,
   not in code.

2. **Historical and live are separate concerns.** They share the canonical model
   and the identity crosswalk. They do not share pipelines.

3. **Both terminate in the SmartVend canonical model.**

4. **External provider identifiers are never SmartVend primary keys.** All
   external identity is held in crosswalk records.

5. **Live ingestion is deterministic.** No LLM sits in the transaction
   processing path.

6. **Raw source evidence is preserved** before any transformation.

7. **Idempotency and replay safety are mandatory**, because delivery is
   at-least-once and providers resend.

8. **Tenant isolation is mandatory** on every record, query, cache key, and
   queue message.

9. **LLM reasoning may assist semantic decisions. Deterministic code proves
   correctness.**

## 8. Canonical model direction

**TARGET.** Provider-neutral. Likely domains, not a finished schema:

tenants, customers and operators, locations, machines, products, planograms,
machine selections, telemetry devices, machine-device bindings, sales, payment
transactions, refunds, chargebacks, inventory, purchases, cash collections,
suppliers, expenses, routes, trips, users and drivers, integration connections,
external identities, migration runs, migration datasets, source artifacts.

The model is defined against the **target** architecture, FastAPI over
PostgreSQL, per ADR-0001. The legacy Supabase path is not a design input.

**PARTIALLY DECIDED.** The schema is finalized from four evidence sources: the
existing SmartVend models, VendSoft extraction evidence, Seed Live payload
evidence, and actual product requirements.

The **MVP business core is now settled by ADR-0003**: Organization, User,
Location, Machine, Product, Slot, and the two-level
`VendTransaction`/`VendTransactionLine` model. It rests on the repository audit
at `593c05ae` and on verified Seed Live transaction-level evidence
(`CANTALOUPE_SEEDLIVE_INTEGRATION.md` §1B), including that one provider
transaction may carry multiple item entries.

**Still open:** the canonical surface beyond that MVP core, and schema
authority, which remains D1. Selection-to-product resolution is still NOT
VERIFIED (§1C), which is why `VendTransactionLine.product_id` and `slot_id` are
nullable rather than required. Neither dependency is Supabase.

Rules that already hold:

- Money is fixed-precision decimal with an explicit currency, never float.
- Timestamps are timezone-aware, stored UTC, and record both event time and
  ingestion time where they differ.
- Ownership follows ADR-0002. "Tenant" is the concept, **Organization** is the
  SmartVend representation, `org_id` is the persistence identity. Control-plane
  **roots** carry explicit organization ownership; subordinate records may
  inherit it through a mandatory parent relationship. The earlier blanket rule
  requiring a tenant column on every table is superseded, having been
  contradicted by the existing schema.
- Every record originating externally carries its source system, source
  identifier, and the source artifact it came from.

## 9. Tenant isolation

**TARGET.** Tenant identity resolves once, at the authentication boundary, from
the authenticated principal. It is never accepted from a request body, query
parameter, or provider payload.

Enforcement lives at the data access boundary, not in each caller. Inbound
provider traffic is bound to a tenant by the connection record the request
authenticates against, never by content inside the payload.

Queues, caches, idempotency keys, and object storage prefixes are all keyed by
tenant. Every tenant-scoped feature carries a negative test proving tenant A
cannot read tenant B.

**DECISION NEEDED.** Isolation model: shared schema with a tenant column,
schema per tenant, or database per tenant. Decided against PostgreSQL per
ADR-0001; depends on schema authority (D1) and on expected customer count.

## 10. External identity model

**TARGET.** A crosswalk table maps external identity to SmartVend identity:

Superseded in detail by **ADR-0002**; that ADR is authoritative for ownership
and uniqueness. Shape:

```
external_identity
  org_id              ADR-0002: Organization is the tenant representation
  provider            e.g. vendsoft, cantaloupe, nayax
  entity_type         machine, product, location, device, selection
  external_id         the provider's identifier, as text
  smartvend_id        FK to the canonical entity
  connection_id       which connection observed it
  mapping_state       UNRESOLVED | RESOLVED | AMBIGUOUS
  first_seen_at, last_seen_at
  confidence, mapping_method   deterministic, proposed, human-confirmed
```

Rules:

- External identifiers are text, never coerced into a SmartVend key type.
- Initial uniqueness direction is `(connection_id, entity_type, external_id)`
  per ADR-0002. The connection scope already carries organization and provider,
  so one key covers both collision axes. Stated as a direction, not a settled
  constraint: it has not been tested against a second provider.
- The same physical machine may carry several external identities across
  providers, which is the normal case during migration plus live operation.
- `productCode` and equivalent provider codes are explicitly not treated as
  globally unique. Prior assumption H remains unverified and must be tested
  against real data before any mapping relies on it.

## 11. Integration connection model

**Platform Task 2 status, 2026-08-15.** Sections 10 to 13 now exist as
provider-neutral **domain contracts** in `backend/integrations/`:
`IntegrationConnection` (`connections.py`), `ExternalIdentity`
(`identities.py`), `RawReportArtifact` (`artifacts.py`), and `OnboardingRun`
with `OnboardingDataset` (`onboarding.py`). Dataclasses, enums and Protocols
with in-memory test doubles. **None of it is persisted** — no table, no
migration, no S3, no SQS. The field lists below remain the target shape.

**TARGET.**

```
integration_connection
  id, org_id           owning organization; see ADR-0002 D1a
  provider            cantaloupe, nayax, vendsoft
  kind                live | historical
  display_name
  status              pending, active, degraded, failed, disabled
  credential_ref      pointer to a secret store entry, never the secret
  config              provider-specific, validated against the connector schema
  health              last_success_at, last_failure_at, consecutive_failures
  created_at, updated_at
```

Credentials are never stored in this table or in the database. Only a reference
is stored. This is the record that makes one connector serve many customers.

## 12. Source artifact and raw evidence model

**TARGET.** Every inbound payload is persisted before parsing.

```
source_artifact
  id, org_id, connection_id
  provider, report_type, report_version
  received_at
  content_hash        sha256 of the raw bytes
  storage_ref         object storage key
  size_bytes
  status              received, parsed, failed, superseded
  parse_error
```

Rules:

- Raw bytes are written first, then parsing is attempted. A parse failure never
  loses the payload.
- `content_hash` is the basis of deduplication and of replay safety.
- Artifacts are immutable. A corrected resend creates a new artifact that
  supersedes the old one; it never overwrites it.
- Retention is explicit and tenant-scoped.

## 13. Onboarding run model

**TARGET.**

```
onboarding_run
  id, org_id, status, started_at, completed_at
  current_phase

onboarding_dataset
  run_id, dataset_key       e.g. machines, products, sales_history
  expected, source, extraction_method
  status                    COMPLETE, PARTIAL, BLOCKED, MISSING,
                            VENDOR_ASSISTANCE_REQUIRED
  record_count_source, record_count_loaded
  conflicts, missing_records, validation_status
  blocking_issues, next_action
```

The run is the unit a human approves. Datasets are the unit of coverage.

## 14. Live Provider Connector SDK

**TARGET.** A single interface every live provider implements, so that adding
Nayax is configuration plus one implementation, not a new pipeline.

Required capabilities per connector:

- declare supported report types, schemas, and versions
- declare transport modes it supports
- validate a connection configuration
- authenticate an inbound request against a connection
- identify report type and version from a payload
- produce a stable deduplication key for a payload
- parse a payload into typed provider records
- map provider records toward canonical entities, emitting unresolved mappings
  rather than guessing
- report health

Explicit non-goals for a connector: it does not write to the canonical model
directly, it does not resolve identity ambiguity on its own, and it does not
call an LLM.

## 15. Seed Live / Cantaloupe discovery

**CURRENT: nothing exists.** No code, no captured payloads, no credentials, no
documented account.

**Discovery must produce, before any parser is written:**

- available report types and their business meaning
- supported transports and which are available on our account
- real captured payloads per report type, redacted where necessary
- schema per report type, with versioning and change behavior
- delivery frequency, ordering guarantees, and whether resends occur
- authentication model and credential rotation story
- rate limits, retry expectations, and error semantics
- how devices, machines, and selections are identified
- refund and adjustment representation
- timezone and currency handling

**DECISION NEEDED.** Nothing downstream of this section can be designed
responsibly until discovery output exists. Writing parsers first would be
invention.

## 16. Seed Live transport architecture

**TARGET, pending discovery.** Candidate transports in preference order:

1. Provider pushes to a SmartVend inbound HTTPS endpoint, authenticated per
   connection, with signature verification if the provider supports it.
2. SmartVend polls a provider API on a schedule.
3. File drop to object storage, with an event triggering ingestion.

Whichever applies, the same rules hold: authenticate against a connection,
persist raw first, acknowledge fast, process asynchronously.

## 17. Report and schema handling

**TARGET.** Each report type has a declared schema and version. Payloads are
validated against it after raw persistence. An unknown or changed schema is a
recorded, alerting condition, never a silent default. Unknown fields are
tolerated and preserved in the raw artifact; missing expected fields are
detected and reported.

## 18. Raw payload preservation

**TARGET.** Covered by the source artifact model in section 12. Object storage
holds the bytes, the database holds the metadata and the hash. Nothing is parsed
before it is durably stored.

## 19. Transaction and line-item processing

**TARGET.** Provider transactions map to canonical payment transactions and
sales, with line items mapping to machine selections and products through the
identity crosswalk.

Deterministic requirements: monetary totals reconcile between header and line
items; currency is explicit; a transaction whose device or selection cannot be
mapped is quarantined with a clear reason, not silently dropped and not
force-mapped.

## 20. Refund and adjustment processing

**TARGET.** Refunds, voids, and chargebacks are modeled as their own records
linked to the original transaction, never as mutations of it. A refund arriving
before or without its original is an expected, handled case. Financial
reconciliation must account for adjustments explicitly.

**MVP scope, ADR-0003 D3c.** "Their own records" means a separate
`VendTransaction` with `transaction_type = REFUND` and an optional
`original_transaction_id` — **not** a separate `Refund` entity, which the MVP
deliberately does not have. Voids and chargebacks are beyond MVP.

## 21. Device to machine mapping

**TARGET.** Telemetry devices are canonical entities in their own right, bound
to machines over time. A device can move between machines, so the binding is
temporal, with validity ranges. Historical transactions resolve to the machine
that the device was bound to at the event time, not the current binding.

## 22. MDB and selection mapping

**TARGET.** Provider selection codes map to SmartVend machine slots and
products through the crosswalk, scoped to a machine and a planogram period.
Selection mappings change when a planogram changes, so they are also temporal.

**DECISION NEEDED.** Whether selection identity is stable across planogram
changes for Cantaloupe. Requires discovery evidence.

## 23. Idempotency and deduplication

**TARGET.** Mandatory at three levels:

1. **Artifact level.** `content_hash` prevents storing an identical payload
   twice.
2. **Record level.** A provider transaction identifier plus connection forms a
   natural key; reprocessing updates nothing and creates nothing.
3. **Effect level.** Any downstream side effect is safe to repeat.

Replaying a stored artifact must produce the same canonical state as the
original processing. This is a required test, not an aspiration.

## 24. Queue architecture

**TARGET.** Inbound receipt and processing are decoupled. The endpoint persists
raw evidence, enqueues, and returns quickly. Workers consume, parse, map, and
write canonically.

SQS where AWS is adopted, with a dead-letter queue, an alarm on dead-letter
depth and on age of oldest message, and a documented replay procedure.
Consumers are idempotent because delivery is at-least-once.

**DECISION NEEDED.** Whether to introduce SQS at MVP or start with a database-
backed queue. Given that no AWS infrastructure exists today, a database-backed
outbox is the smaller first step and can be replaced behind the same interface.

## 25. Retry and failure handling

**TARGET.** Bounded retries with exponential backoff, applied only to idempotent
operations. Retryable failures, timeouts, rate limits, transient upstream
errors, are distinguished from terminal ones, validation and authorization
failures. Retry exhaustion moves the item to a dead-letter destination and
raises an alert. Nothing retries forever and nothing fails silently.

## 26. Integration health and monitoring

**TARGET.** Per connection: last success, last failure, consecutive failures,
call volume, error rate, latency, timeout rate, rate-limit responses, queue
depth, dead-letter count, and parse failure rate.

A connection that has stopped delivering must be detectable without a customer
reporting it. Silence is a failure mode: expected-delivery windows are modeled
so that absence of data raises an alert.

## 27. Master Onboarding Orchestrator

**TARGET.** Coordinates onboarding state across both control planes.

Responsibilities: source discovery, expected-dataset identification, connector
capability awareness, onboarding run state, mapping proposals, missing-data
detection, next-action recommendation, retry coordination, Migration Coverage
Manifest evaluation, human escalation, and cutover readiness.

The orchestrator owns control flow deterministically. It may consult an LLM for
specific semantic questions and then act on validated, structured output. It
does not hand control flow to a model.

## 28. Bedrock-assisted reasoning boundaries

**TARGET.** Explicit and enforced.

LLM assistance **may** be used for: semantic mapping proposals, classifying an
unfamiliar dataset, explaining a conflict in human terms, gap analysis, and
recommending a next action.

LLM assistance **may not** be the authority for: counts, hashes, duplicate
detection, financial totals, date coverage, referential integrity, idempotency,
source-to-target reconciliation, or any declaration that a migration is
complete.

Every LLM output that reaches a decision is validated against a schema and
recorded with the model identifier and the inputs used. A mapping proposed by a
model is marked `proposed` and requires either deterministic confirmation or
human confirmation before it is trusted.

## 29. Migration Coverage Manifest

**TARGET.** The authoritative record of onboarding progress, one row per
expected dataset, carrying: expected, extracted, validated, loaded, source,
record count, conflicts, missing records, validation status, blocking issues,
and next action.

Statuses: `COMPLETE`, `PARTIAL`, `BLOCKED`, `MISSING`,
`VENDOR_ASSISTANCE_REQUIRED`.

Only deterministic checks can move a dataset to `COMPLETE`. An LLM cannot
declare completeness.

## 30. Deterministic reconciliation

**TARGET.** For every migrated dataset, computed by code:

- source record count against loaded record count
- financial totals by period, to the cent
- date range coverage and gap detection
- referential integrity across canonical entities
- duplicate detection by natural key
- unmapped entity counts by type
- hash-based verification against preserved raw artifacts

Each check reports pass or fail with the specific records implicated. A
reconciliation report is the evidence attached to a coverage manifest entry.

## 31. AWS architecture direction

**CURRENT: no AWS exists in the repository.**

**TARGET, where justified:** S3 for raw artifacts, SQS for ingestion queueing,
Secrets Manager for connection credentials, RDS PostgreSQL for the canonical
model, CloudWatch for logs, metrics, and alarms, Step Functions for long-running
onboarding orchestration if the state machine outgrows application code.

**DECISION NEEDED.** Whether the MVP deploys to AWS at all, and in which
account and environment structure. Nothing in the repository establishes this
today, so no AWS design is treated as settled. Every AWS component must be
justified by a requirement, not adopted because it appears here.

## 32. Security requirements

- Credentials live in a managed secret store. The database stores only a
  reference. No credential appears in code, configuration, logs, or an error.
- Every inbound provider request is authenticated against a connection, and
  signature-verified where the provider supports it.
- Tenant identity comes from the connection or the authenticated principal,
  never from payload content.
- Provider payloads are untrusted input. They are validated before use, and
  never executed, interpolated into SQL, or used to build file paths.
- Raw artifacts may contain PII and are treated as customer data: encrypted at
  rest, access-controlled, and retention-bounded.
- LLM prompts never contain secrets, and retrieved or provider content placed in
  a model context is treated as hostile.
- The known exposed credential from public Git history is treated as
  compromised. Rotation is a human action tracked outside this gameplan.
- No customer data is committed to this repository, which is public.

## 33. Human approval and cutover

Cutover is a human decision. The orchestrator prepares evidence; it does not
approve.

Preconditions: every required dataset `COMPLETE` or explicitly accepted,
deterministic reconciliation passing, live integration healthy for a defined
observation window, unmapped entities resolved or accepted, and a documented
rollback position.

Approval is recorded with who approved, when, and against which coverage
manifest version.

## 34. MVP phases

| Phase | Outcome | Depends on |
| --- | --- | --- |
| P0 | Baseline established: audit, gameplan, EVO, validation baseline | done in this checkpoint |
| P1 | Seed Live discovery documented with real captured payloads | provider access |
| P2 | Canonical model v1 for the live path: connections, external identity, source artifacts, devices | P1, D1 schema authority |
| P3 | Inbound endpoint with authentication, raw preservation, and deduplication | P2 |
| P4 | Deterministic parsers for transactions, line items, devices, refunds | P1, P3 |
| P5 | Device and selection mapping with the crosswalk | P4 |
| P6 | Queue-backed processing, retries, dead-lettering, health and monitoring | P3 |
| P7 | Connector SDK generalized, proven by a second provider shape | P4 to P6 |
| P8 | Orchestrator, coverage manifest, deterministic reconciliation | P2, and Ganesh's historical path |
| P9 | Bedrock-assisted proposals within declared boundaries | P8 |
| P10 | Pilot cutover with human approval | all |

Phases are ordered by dependency, not by date. No date estimates are recorded
here because provider access timing is unknown.

## 35. Acceptance criteria

- A payload delivered twice produces exactly one canonical effect.
- A payload that cannot be parsed is preserved, quarantined, and alerted, never
  lost.
- A transaction whose device or selection cannot be mapped is quarantined with a
  specific reason, never force-mapped.
- Replaying a stored artifact reproduces identical canonical state.
- Tenant A cannot read or affect tenant B, proven by test.
- No external provider identifier is used as a SmartVend primary key.
- Financial totals reconcile to the cent against the source.
- A stalled connection is detected by monitoring, not by a customer.
- No LLM output can move a dataset to `COMPLETE`.
- Adding a second live provider requires no change to the ingestion pipeline.

## 36. Open decisions

| # | Decision | Blocks |
| --- | --- | --- |
| D1 | Which schema is authoritative, and when is Alembic initialized? | any schema change |
| D2 | ~~Tenant isolation model~~ **SETTLED** by ADR-0002 D1a and the Task 1 audit: shared schema, explicit `org_id` on roots, inherited ownership through a mandatory safe parent | nothing |
| D3 | AWS adoption at MVP, and account and environment structure | queueing, storage, secrets |
| D4 | SQS at MVP or a database-backed outbox first | P6 |
| D5 | Minimum test and CI baseline before further feature work | all engineering |
| D6 | Remediation plan for committed customer data and the exposed credential | security posture |
| D7 | Seed Live transport mode | P3 |

Each becomes an ADR in `.evo/project/decisions/` when decided.

Already decided, recorded as ADRs:

| ADR | Decision |
| --- | --- |
| ADR-0001 | SmartVend business data is consolidated behind FastAPI and PostgreSQL. Supabase is retired from business-data access. |

## 37. Known blockers

1. **No Seed Live access or captured payloads.** Blocks P1 onward. This is the
   critical path and the only blocker on it.
2. **No test or CI baseline.** Every change is unverified.
3. **Backend dependencies not installed and no committed virtualenv**, so the
   backend cannot currently run or be validated.
4. **Alembic not initialized**, so schema changes have no mechanism. D1.

No blocker depends on Supabase. ADR-0001 settled the target architecture, so
canonical model and live-provider contract design can proceed against FastAPI
and PostgreSQL regardless of how far the consolidation migration has progressed.

## 38. Current milestone

Baseline architecture audit and EVO onboarding. Delivered in this checkpoint:
the current-state audit, this gameplan, the target architecture, EVO v0.1.1
installed, project context and state, and a validation baseline.

Next milestone is P1, Seed Live discovery, which cannot begin without provider
access.

## 39. Definition of done for the MVP

The MVP is done when a real vending operator is onboarded end to end: their
historical VendSoft data migrated and deterministically reconciled, a live Seed
Live integration delivering into the canonical model with idempotency and health
monitoring, a Migration Coverage Manifest showing every expected dataset
resolved, raw evidence preserved and re-verifiable, external identities mapped
through the crosswalk with no external identifier used as a primary key, tenant
isolation proven by test, and a human approving cutover against that evidence.

Passing tests alone do not satisfy this definition.
