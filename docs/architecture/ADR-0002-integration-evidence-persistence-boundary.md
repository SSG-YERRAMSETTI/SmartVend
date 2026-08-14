# ADR-0002 Integration evidence and persistence boundary

- Status: Accepted
- Date: 2026-08-14
- Supersedes: none
- Related: ADR-0001 (consolidate business data behind FastAPI and PostgreSQL)
- Concepts explained in: `SMARTVEND_INTEGRATION_ARCHITECTURE_GUIDE.md`

This ADR records decisions. The guide explains the terminology. Read the guide
first if any term here is unfamiliar.

## Context

SmartVend is building an integration control plane to receive data from
external providers such as Cantaloupe / Seed Live, VendSoft, and later Nayax.
The inbound scaffold, artifact contract, idempotency foundation, and HTTP Basic
authentication boundary exist. None of it can be persisted yet, because the
ownership question was unresolved: **what does the integration layer own, and
what must remain owned by SmartVend's canonical business model?**

An audit of the repository at commit `71f0f2f5` established the facts that
force these decisions:

- The database has an `organizations` table and 24 `org_id` columns. There is
  **no** `tenant_id` column anywhere and no separate tenant entity.
- 13 of 37 tables carry no organization column at all, including `slots`,
  `telemetry_events`, `machine_inventory`, `daily_sales_summary`,
  `cash_collections`, and `receipt_lines`. Ownership is inherited through a
  mandatory parent.
- There is **no** repository, service, port, or unit-of-work abstraction
  anywhere in `backend/`. Fourteen modules use the database session directly,
  and route handlers call `db.add()` and `db.commit()` inline.
- `machines` already carries `external_code` and `telemetry_device_id`, plain
  text columns that hold a narrow form of external identity. Both appear in the
  API schemas, so they have consumers.
- `webhooks` stores a secret value directly in a `secret` column.

Our own written architecture said `tenant_id` and asserted that every
tenant-scoped table carries a tenant column. Both statements were wrong about
this repository. Building persistence contracts on them would have encoded the
error into the schema and into the idempotency key.

## Decision

### D1a — Tenant is a concept; Organization is the representation

| Layer | Name |
| --- | --- |
| Architectural concept | **tenant** |
| SmartVend representation | **Organization** |
| Persistence identity | **`org_id` → `organizations.id`** |

We do **not** introduce a second Tenant entity beside Organization. One concept
with two competing representations is how a system acquires two sources of
truth for ownership, which is the worst possible place to have one.

**Production integration code is not refactored from `tenant_id` to `org_id` in
this checkpoint.** The rename touches the idempotency key derivation, which is
security-relevant and deserves its own reviewed change. It is recorded as the
next implementation change.

#### Correcting the tenant-column rule

The previously stated rule, that every tenant-scoped table must physically
contain a tenant column, is **too broad** and is contradicted by the existing
schema. It is replaced by:

1. **Integration and control-plane roots carry explicit organization
   ownership** where appropriate. A connection, an artifact, an onboarding run,
   and an external identity are roots.
2. **Subordinate records may inherit organization ownership through a mandatory
   parent relationship**, when that relationship is structurally guaranteed:
   the foreign key is `NOT NULL`, points at a row that carries ownership, and
   cannot be reparented across organizations.
3. **Organization context is never derived from provider payload content.**

Rule 2 is a genuine relaxation and carries a genuine cost: inherited ownership
is only as strong as the join that enforces it, and a nullable or reparentable
foreign key silently breaks it. Any table relying on inheritance must document
which parent carries ownership.

**Deviation note.** EVO's `standards/database.md` states the stricter rule.
This project deviates for the existing schema, and the deviation is recorded as
a project exception in `.evo/project/config.toml` rather than by editing the
EVO-owned standard.

### D1b — A canonical application write port, deferred

**Integration code does not own or persist canonical SmartVend business
entities.** It may reference canonical identifiers. It must not create machine,
product, location, slot, sale, or transaction rows.

A **canonical application write port** separates integration transformation
from canonical persistence:

```
integration canonicalization
        -> SmartVend application write port
        -> canonical persistence (application workstream)
```

**The port is not implemented in this checkpoint, and not designed here.**

The reason is not scheduling. No such boundary exists anywhere in the
application today, so defining one means either inventing an application
service layer, which belongs to the application workstream, or writing an
interface that points at nothing. Both are worse than waiting. This requires
agreement with the application workstream owner before it is designed.

Until the port exists, integration work stops at canonical transformation and
does not write.

### D1c — External identity uses a generic crosswalk

New integrations resolve provider identifiers through a generic
`ExternalIdentity` crosswalk, shaped as described in guide section 11.

**Initial uniqueness direction: `(connection_id, entity_type, external_id)`.**

The connection scope carries both the organization and the provider, so one key
prevents cross-tenant and cross-provider collisions. This is stated as a
direction rather than a settled constraint because it has not been tested
against a second provider's data.

**External identifiers are never assumed globally unique.** For Cantaloupe, the
transaction identifier observed in one export was unique *within that export*,
which establishes nothing about uniqueness across exports, accounts, or time.

**Provider identifiers never become SmartVend primary keys.**

Mapping state must be able to express **UNRESOLVED**, **RESOLVED**, and
**AMBIGUOUS**. A model that can only express "mapped" forces a guess or a
silent discard, and both corrupt data invisibly.

#### Pre-existing compatibility fields

`Machine.external_code` and `Machine.telemetry_device_id` are classified
**PRE-EXISTING COMPATIBILITY FIELDS**.

- They **remain untouched** by this decision.
- They are **not** the generic external identity solution, and new integrations
  do not use them.
- They appear in the API schemas and therefore have consumers.

**Their consumers and semantics must be inventoried before any deprecation,
synchronization, or migration decision.** Until that inventory exists, we do
not know whether the crosswalk should eventually replace them, mirror them, or
coexist with them, and guessing would break a live API.

### Credentials

New integration credentials use a **credential reference**, never a stored
secret value. AWS Secrets Manager is the intended production direction and is
not implemented.

`Webhook.secret`, which stores a secret value directly in the database, is
recorded as **pre-existing security debt**. It belongs to the application
workstream. **It is not modified here.**

## Storage responsibility

Intended, none of it implemented:

| Store | Holds |
| --- | --- |
| PostgreSQL / RDS | Connection metadata, external identity crosswalks, artifact metadata, idempotency records, ingestion and processing state, reconciliation state, and the canonical business records |
| S3 | Immutable raw provider artifacts |
| Secrets Manager | Secret values |
| Database | Credential **references** only, never secret material |
| SQS | Asynchronous processing handoff, later |
| CloudWatch | Operational events, health, and metrics, later |

## Ownership summary

**Control plane owns:** integration connections, provider identity, credential
references, connection lifecycle state, provider configuration references,
source artifacts and their metadata, payload hashes, delivery metadata,
ingestion attempts, processing and replay state, idempotency records, the
external identity crosswalk, mapping resolution state, onboarding runs, and
migration and reconciliation evidence.

**Business domain owns:** machines, locations, products, slots, transactions,
line items, refunds, operator business entities, and every other SmartVend
application-domain record.

**The integration layer may reference canonical entity identifiers. It must
never become the owner of a duplicate machine, product, or transaction model.**

## Consequences

- Persistence contracts can now be designed against a correct picture of
  ownership rather than an assumed one.
- The `tenant_id` to `org_id` rename becomes a required, reviewable follow-up
  that touches the idempotency key. Until it lands, integration code and the
  database disagree on the name of the ownership column, which is a real if
  contained inconsistency.
- Inherited organization ownership is permitted, so tenant isolation review
  must check join integrity, not merely the presence of a column.
- The write port's absence blocks canonical writes entirely. Integration work
  can proceed up to canonical transformation and no further, which is a real
  constraint on the roadmap.
- The compatibility fields stay in place, so two mechanisms for external
  identity will coexist until the inventory is done. That is accepted
  deliberately over breaking a live API on an assumption.

## Revisit if

The application workstream introduces a service or repository layer, which
would let D1b be designed properly. Or a second provider's data shows that
`(connection_id, entity_type, external_id)` is insufficient, which would reopen
D1c's uniqueness direction.
