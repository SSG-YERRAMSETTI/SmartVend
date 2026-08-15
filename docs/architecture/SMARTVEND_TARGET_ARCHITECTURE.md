# SmartVend target architecture

TARGET STATE. This document describes intended design. It is not a description
of what exists.

Current verified state is in `SMARTVEND_CURRENT_STATE_AUDIT.md`. The engineering
plan that drives this design is
`../gameplans/SMARTVEND_PLATFORM_ARCHITECTURE_AND_SEEDLIVE_MVP.md`.

- Date: 2026-08-12
- Derived from baseline commit `204a4bb46bc1969704f6ea0045a9527042385a89`
- Status: proposed, not accepted. Items marked DECISION NEEDED require an ADR
  before implementation.

## 0. Application data path

Accepted, ADR-0001. This is settled, not proposed.

```
React  ->  FastAPI  ->  PostgreSQL
```

- **No direct frontend business-data access to Supabase.**
- Development: local PostgreSQL.
- Production: Amazon RDS PostgreSQL, intended target. AWS implementation is
  future work and is **not** current verified infrastructure.

Supabase business-data access that exists today is legacy technical debt to be
migrated by the consolidation workstream. It is not an architectural option
still under consideration, and it is never a design input for the canonical
model or for live-provider contracts.

Authentication is evaluated separately. Authentication already runs through
FastAPI with JWT and bcrypt; the Supabase client remains configured to persist
sessions. The presence of Supabase data access is not a reason to keep Supabase
Auth, and no auth decision is implied here.

Ownership: Ganesh owns the consolidation implementation, including migrating the
frontend hooks. This workstream designs against the target and does not refactor
those hooks.

## 1. Gap between current and target

| Concern | Current | Target |
| --- | --- | --- |
| Business-data path | Two: React to Supabase for most domains, React to FastAPI for a few | One: React to FastAPI to PostgreSQL, ADR-0001 |
| Schema authority | Three definitions, none authoritative | One, owned by migrations |
| Migrations | Alembic declared, never initialized | Alembic authoritative and applied |
| Live providers | None | Connector SDK with Cantaloupe first |
| Raw evidence | None | Every payload preserved before parsing |
| External identity | None | Crosswalk, no external IDs as primary keys |
| Tenancy | Shared schema; 24 tables carry explicit `org_id`, 12 inherit through a mandatory parent. Route handlers already enforce the join | Unchanged in shape; enforced consistently at the data access boundary |
| Queueing | None | Outbox first, SQS when AWS is adopted |
| Tests and CI | None | Required baseline before feature work |
| Infrastructure | None | AWS, scope to be decided |

## 2. Shape

```
                    SMARTVEND ONBOARDING PLATFORM

                        Master Onboarding
                          Orchestrator

              /                                    \
   Migration Control Plane              Integration Control Plane
   (historical, one-time)               (live, continuous)

   VendSoft                             Cantaloupe / Seed Live
   Other VMS                            Nayax
   CSV / Excel                          future providers
   Portal exports

              \                                    /
                    Raw Evidence / Staging
                              |
                      Canonical Mapping
                              |
                      Validation Engine
                              |
                 Migration Coverage Manifest
                              |
                       Human Approval
                              |
                          SmartVend
```

The two control planes are deliberately separate. They share the canonical
model, the external identity crosswalk, and the source artifact store. They do
not share pipelines, because a one-time bulk history load and a continuous
at-least-once live feed have different failure modes.

## 3. Canonical operational model

Provider-neutral, owned by SmartVend. Domains listed in gameplan section 8.

### 3.1 MVP canonical model

**Accepted, ADR-0003.** The MVP business core. Deliberately excludes logistics
and reporting tables, which are listed in 3.2.

```
Organization
 ├── User                    1:N   org_id nullable for platform_admin only
 ├── Location                1:N   required
 ├── Product                 1:N   required
 ├── Machine                 1:N   required
 │    ├── Location           N:1   OPTIONAL, machine may be unplaced
 │    └── Slot               1:N   required, CASCADE, UNIQUE(machine, position)
 │         └── Product       N:1   OPTIONAL, unresolved selection allowed
 └── VendTransaction         1:N   required
      ├── Machine            N:1   required
      ├── original_transaction  N:1    OPTIONAL, self-reference, refunds only
      └── VendTransactionLine   1:0..N OPTIONAL, a transaction may have no lines
           ├── Slot          N:1   OPTIONAL
           └── Product       N:1   OPTIONAL
```

`VendTransaction` and `VendTransactionLine` are **TARGET and unimplemented**.

`VendTransaction` carries `total_amount`, the transaction-level monetary
magnitude, so a valid monetary event stays representable when line detail is
missing, incomplete, or unavailable. Lines are therefore `0..N`, and **a
synthetic "unknown" line is never fabricated to satisfy cardinality**.

`transaction_type` is `SALE` or `REFUND`; a refund is typed, never signed.
`total_amount`, `quantity` and `unit_price` are always positive, so net-revenue
calculations must branch on `transaction_type` rather than rely on signed
storage. Where lines exist, `sum(quantity * unit_price)` may be compared to
`total_amount` as a reconciliation control, but line sums are **not**
authoritative over the header — differences may reflect rounding, discounts,
taxes, or incomplete extraction, and resolving them is reconciliation work, not
Task 1.

Ownership: `Organization`, `Location`, `Product`, `Machine` and
`VendTransaction` carry explicit `org_id`. `Slot` inherits through `Machine`,
`VendTransactionLine` through `VendTransaction`. Both inheritance paths are
NOT NULL and non-reparentable, satisfying ADR-0002 D1a.

Price layers, unchanged: `Product.sell_price` is catalog base,
`Slot.price_override` is the configured selection price, `Slot.dex_price` is
telemetry-observed and may drift, and `VendTransactionLine.unit_price` is the
actual transacted value.

Provider identity, artifact, connection, ingestion and parser fields are
**excluded** from these entities by ADR-0003 D3e. They belong to the
integration control plane.

### 3.2 Canonical entities deferred beyond MVP

| Entity | Status |
| --- | --- |
| `sales` | **Legacy compatibility fact**, ADR-0003 D3d. Live Supabase frontend consumer, no backend writer. Not deleted, not migrated, not modified. |
| Route, Trip, RouteStop, RestockEntry | Working today, not required by the Seed Live path |
| InventoryBatch, InventoryLedger, MachineInventory | Working today; representations overlap, normalization deferred |
| Receipt, ReceiptLine, ProductSupplierPackaging, Expense, MileageLog | Working today, outside the MVP transaction core |
| DailySalesSummary | Derived/reporting, no writer |
| CommissionStatement, PriceList, PriceListItem, RefillOrder, InventoryTransfer, Ticket, Vehicle, Warehouse | Declared; several unused |
| TelemetryEvent, Alert, AlertRule, Webhook, ApiKey, AuditLog | Operational support, unused |

Binding rules:

- Money is fixed-precision decimal with explicit currency. Never float.
- Timestamps are timezone-aware and stored UTC. Event time and ingestion time
  are distinct columns where both matter.
- Ownership follows ADR-0002. "Tenant" is the architectural concept,
  **Organization** is SmartVend's representation, and `org_id` referencing
  `organizations.id` is the persistence identity. There is no `tenant_id`
  column in this database.
- Integration and control-plane **roots** carry explicit organization
  ownership. Subordinate records may inherit it through a mandatory parent
  relationship when that relationship is structurally guaranteed. The earlier
  blanket rule, that every tenant-scoped table physically carries a tenant
  column, was contradicted by the existing schema and is superseded.
- Every externally-sourced record references its source system, source
  identifier, and originating source artifact.
- Temporal bindings, device to machine and selection to slot, carry validity
  ranges so historical events resolve against the binding in force at event
  time.

The **MVP** canonical business model is settled by ADR-0003, using verified
Seed Live transaction-level evidence. The database technology and access path
are fixed by ADR-0001. What is still open is the canonical surface beyond the
MVP core and schema authority (gameplan D1).

## 4. Live provider framework

```
provider payload
    -> inbound transport (authenticated per connection)
    -> raw artifact persisted (hash, object storage)
    -> enqueue
    -> schema validation against declared report type and version
    -> deduplication by content hash and provider record key
    -> device and selection mapping via crosswalk
    -> canonical transformation
    -> canonical model
```

Failure at any stage after persistence leaves the artifact intact and
quarantines the item with a reason. Nothing is dropped.

## 5. Connector SDK

One implementation per provider, many connections per customer. The interface is
specified in gameplan section 14.

A connector declares its report types, schemas, versions, and transports;
authenticates an inbound request against a connection; identifies and
deduplicates payloads; parses into typed provider records; and proposes
canonical mappings, emitting unresolved mappings rather than guessing.

A connector never writes canonical records directly, never resolves identity
ambiguity alone, and never calls an LLM.

## 6. Connection registry

`integration_connection` as specified in gameplan section 11. One row per
customer-provider relationship, carrying provider, kind, status, a credential
reference, validated provider-specific configuration, and health counters.

Credentials are stored in a managed secret store. The database holds only a
reference.

## 7. Raw evidence store

`source_artifact` as specified in gameplan section 12. Bytes in object storage,
metadata and SHA-256 in the database, artifacts immutable, corrections modeled
as superseding records, retention explicit and tenant-scoped.

This is the evidence layer that makes deterministic reconciliation possible
after the fact.

## 8. Processing pipeline

Receipt and processing are decoupled. The inbound endpoint authenticates,
persists raw, enqueues, and returns quickly. Workers do parsing, mapping, and
canonical writes.

Consumers are idempotent because delivery is at-least-once. Retries are bounded
with backoff and applied only to idempotent operations. Exhaustion moves the
item to a dead-letter destination and raises an alert.

DECISION NEEDED: outbox table first, or SQS immediately. Given no AWS exists
today, an outbox behind the same interface is the smaller first step.

## 9. Mapping layer

All external-to-SmartVend identity resolution happens here, through the
crosswalk described in gameplan section 10.

Mappings carry a method: deterministic, proposed, or human-confirmed. Proposed
mappings, including any originating from an LLM, are not trusted until
deterministically confirmed or human-confirmed. Unmapped entities are surfaced
as work items, never silently defaulted.

## 10. Orchestration

The Master Onboarding Orchestrator owns onboarding state and control flow
deterministically, as specified in gameplan section 27. It may consult an LLM
for bounded semantic questions and act on validated structured output. It does
not delegate control flow to a model.

## 11. Validation and reconciliation

Deterministic checks defined in gameplan section 30: counts, financial totals to
the cent, date coverage, referential integrity, duplicate detection, unmapped
entity counts, and hash verification against preserved artifacts.

The Migration Coverage Manifest is the authoritative progress record. Only
deterministic checks can mark a dataset `COMPLETE`.

## 12. AWS components

TARGET, each pending justification: S3 for raw artifacts, SQS for ingestion,
Secrets Manager for credentials, RDS PostgreSQL for the canonical model,
CloudWatch for logs, metrics and alarms, Step Functions if orchestration state
outgrows application code.

DECISION NEEDED: whether the MVP deploys to AWS at all, and the account and
environment structure. No AWS resource is created without explicit human
authorization.

## 13. Security boundaries

- Credentials in a secret store, referenced not embedded.
- Inbound provider requests authenticated per connection, signature-verified
  where supported.
- Tenant identity from the connection or authenticated principal, never from
  payload content.
- Provider payloads treated as untrusted input: validated, never executed,
  interpolated into SQL, or used to construct file paths.
- Raw artifacts treated as customer data: encrypted at rest, access-controlled,
  retention-bounded.
- LLM contexts never contain secrets; retrieved and provider content is treated
  as hostile.
- No customer data in this repository, which is public.

## 14. Tenant isolation

Resolved once at the authentication boundary and enforced at the data access
boundary. Queues, caches, idempotency keys, and storage prefixes are keyed by
tenant. Cross-tenant access is an explicitly modeled, audited capability.

Every tenant-scoped feature carries a negative test proving isolation.

SETTLED: **shared schema with an organization column**, per ADR-0002 D1a and
confirmed by the Task 1 audit. This was previously listed as a decision needed;
it was already decided in the existing schema, which uses `org_id` on 24 tables
and inherited ownership on 12 more. Schema-per-tenant and database-per-tenant
are not under consideration.

## 15. What this document does not decide

- The final canonical schema beyond the MVP core. The **MVP** business model is
  settled by ADR-0003, section 3.1 above. What remains open is the non-MVP
  surface and schema authority, gameplan D1.
- How the legacy `sales` table is retired, populated, or migrated. ADR-0003 D3d
  requires that decision before either representation is written.
- Seed Live transport. Requires discovery.
- Whether selection identity is stable across planogram changes. Requires
  discovery.
- Whether `productCode` is safe as an external key. Requires real data.
- AWS adoption and environment structure, so RDS remains a target rather than a
  commitment to a deployment.
- Authentication mechanism, which is evaluated on its own merits.
- The sequencing of the migration off Supabase. The destination is settled by
  ADR-0001; the execution order belongs to the consolidation workstream.
