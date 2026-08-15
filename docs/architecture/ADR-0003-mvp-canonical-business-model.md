# ADR-0003 MVP canonical business model

- Status: Accepted
- Date: 2026-08-14
- Supersedes: none
- Related: ADR-0001 (consolidate business data behind FastAPI and PostgreSQL),
  ADR-0002 (integration evidence and persistence boundary)
- Concepts explained in: `SMARTVEND_INTEGRATION_ARCHITECTURE_GUIDE.md`
- Evidence: repository audit at commit `593c05ae`, ClickUp Task 1 sub-checkpoint 1A

This ADR fixes the **target** canonical business model for the MVP. It changes
no code, no schema, and no migration. Nothing here is implemented.

## Context

SmartVend needs a canonical business model that is stable enough for live
provider integrations to target. Task 1 asks for a coherent, functional MVP
model, not a theoretically complete domain model, and explicitly prefers
existing working entities over redesign.

A full audit of the repository established the facts below. Every one is from
code, not from prior summaries.

**The existing core works.** 37 ORM models, 38 tables in `schema.sql`. 24
tables carry explicit `org_id`; 12 subordinate tables inherit ownership through
a mandatory parent, and `organizations` is the root itself. Route handlers
already enforce inherited ownership by joining to the owning parent rather than
assuming it: `trips_routes.py` resolves the machine within `org_id` before
returning its slots, and `ops_routes.py` scopes `daily_sales_summary` through
`machines.org_id`. That is exactly the join integrity ADR-0002 requires.

**The transaction model does not work.** The `sales` table:

- has **zero** readers or writers anywhere in `backend/`;
- is consumed only by the frontend, reading `sales` directly from Supabase in
  `src/hooks/useSales.tsx`, which is the legacy path ADR-0001 retires;
- represents **one product per row**, with no transaction header, so a
  multi-item vend cannot be grouped;
- models **no refund** of any kind;
- carries **no external transaction identity**;
- has **no uniqueness constraint**, so re-delivery duplicates revenue;
- has **no `slot_id`**, so the selection that produced a sale cannot be recorded.

The backend says so itself, at `ops_routes.py`: *"That table is empty until real
vend/sale transactions are recorded somewhere in the system — so revenue will
correctly show $0 until that exists."*

**Provider evidence.** `CANTALOUPE_SEEDLIVE_INTEGRATION.md` §1B records verified
transaction-level Seed Live evidence, including that one provider transaction
may carry multiple item entries. §1C classifies selection-to-product resolution
as **NOT VERIFIED**. A canonical model that requires a resolved product cannot
accept Seed Live data at all.

## Decision

### D3a — Approve the existing core unchanged

`Organization`, `User`, `Location`, `Machine`, `Product`, and `Slot` are
approved as canonical MVP business entities **as they exist today**. They are
not redesigned.

| Entity | Ownership | Notes |
| --- | --- | --- |
| `Organization` | is the tenant root | Concrete representation of "tenant", ADR-0002 D1a |
| `User` | explicit `org_id`, nullable | Nullable only for `platform_admin`, enforced by a CHECK constraint |
| `Location` | explicit `org_id`, NOT NULL | |
| `Machine` | explicit `org_id`, NOT NULL | `location_id` **stays nullable**: a machine may be unplaced |
| `Product` | explicit `org_id`, NOT NULL | Organization-scoped catalog |
| `Slot` | **inherited** via `machine_id` | NOT NULL, CASCADE, `UNIQUE(machine_id, position)` |

`Slot.position` remains SmartVend's machine-local selection/coil identifier. It
is already populated from real planogram data by `import_planograms.py`.
`Slot.product_id` **stays nullable**: the importer already creates coils with no
product when a name does not match, so an unresolved selection is an existing,
accepted, working state.

### D3b — The canonical transaction model is two-level

**The existing `sales` table is NOT approved as the canonical transaction
model.** Its shape cannot represent a multi-item provider transaction, a refund,
or an unresolved selection.

Two target concepts replace it:

```
VendTransaction  1 ─── 0..N  VendTransactionLine
```

**`VendTransaction`** — the business event, one per vend or refund:

| Field | Notes |
| --- | --- |
| `id` | SmartVend-generated |
| `org_id` | explicit, NOT NULL. Owning organization |
| `machine_id` | NOT NULL. The machine the event occurred on |
| `occurred_at` | timezone-aware event time |
| `transaction_type` | `SALE` or `REFUND` |
| `total_amount` | transaction-level monetary magnitude, always positive |
| `payment_method` | where known |
| `original_transaction_id` | nullable self-reference, for refunds |
| `created_at` | |

**Why the header carries `total_amount`.** A valid vending transaction must stay
representable when line-item detail is missing, incomplete, unresolved, or
simply unavailable from the provider. Requiring line enrichment in order to
preserve the monetary event would mean losing the event whenever extraction is
partial — the same failure mode nullable `product_id` exists to prevent, one
level up.

**`VendTransactionLine`** — what was vended:

| Field | Notes |
| --- | --- |
| `id` | |
| `transaction_id` | **required** |
| `slot_id` | **nullable** |
| `product_id` | **nullable** |
| `quantity` | positive |
| `unit_price` | the actual transacted unit value |

**Why `slot_id` and `product_id` are nullable.** SmartVend must preserve a valid
business event even when selection-to-slot or selection-to-product mapping is
unresolved. Seed Live's selection-to-product resolution is NOT VERIFIED, so
requiring either would mean discarding real transactions. A business event is
never dropped because enrichment has not completed; it is recorded, and
enrichment fills in later. This mirrors the behavior `Slot.product_id` already
has.

**Cardinality is `1:0..N`, not `1:N`.** A transaction may legitimately exist
before or without any line detail. **A synthetic or "unknown" line must never be
fabricated to satisfy cardinality** — an invented line is indistinguishable from
a real one downstream, and would corrupt both reconciliation and any per-product
aggregate. Zero lines is an honest state; a fake line is not.

#### Monetary semantics

- `total_amount` is the transaction-level magnitude and is **always positive**.
- `quantity` is positive. `unit_price` is the positive transacted unit value.
- `transaction_type` carries `SALE` versus `REFUND` meaning.
- **Negative quantity and negative price are never the canonical refund
  indicator.**

For a refund: `transaction_type = REFUND`, `total_amount` holds the refund
magnitude, and `original_transaction_id` references the original transaction
when known.

**Net-revenue calculations must interpret `transaction_type`, never rely on
signed storage.** A query that sums `total_amount` without branching on type
will report refunds as revenue.

#### Line reconciliation

Where lines exist, `sum(quantity * unit_price)` **may be compared** to
`total_amount` as a reconciliation control.

**Line sums are not automatically authoritative over the header.** A difference
is a signal, not an error to auto-correct. It may indicate provider rounding,
discounts, taxes or fees, incomplete line extraction, a parser defect, or other
provider semantics not yet understood. Distinguishing those requires provider
evidence that does not exist yet, so **richer reconciliation rules are out of
scope for Task 1** and belong to the reconciliation workstream.

**Naming.** `VendTransaction` / `VendTransactionLine` keeps the two-level
semantic model explicit and avoids colliding with the existing `sales` table.
Table names follow repository convention: `vend_transactions`,
`vend_transaction_lines`.

### D3c — Refunds use the same model, typed, never signed

For MVP a refund is a `VendTransaction` with `transaction_type = REFUND`,
`total_amount` holding the refund magnitude as a positive value, and
`original_transaction_id` set when the original canonical transaction is known.
A partial refund carries only the affected lines, or none at all if line detail
is unavailable.

**Negative quantity and negative price are not the canonical indicator of a
refund.** Providers may present signed values at their boundary; the canonical
**type** carries the business meaning. Sign conventions are a parsing detail and
must not leak into the canonical model, where they would silently corrupt every
aggregate that sums without inspecting type.

**No separate `Refund` entity for MVP.** This is an MVP decision and may evolve
if accounting later requires a richer refund lifecycle — settlement state,
partial-refund tracking against remaining balance, or chargeback handling.

### D3d — The existing `sales` table is legacy

`sales` is classified **PRE-EXISTING COMPATIBILITY / LEGACY SALES FACT**.

- **Not deleted, not migrated, not modified** in Task 1.
- It has a live frontend consumer over the Supabase path.
- Its shape is insufficient for provider-neutral canonical transactions.

**Future implementation must determine how the legacy path is retired,
populated for compatibility, or migrated.** Until that is decided, `sales` and
`vend_transactions` must never both be written. **Two active sources of truth
for revenue is the outcome this decision exists to prevent.**

### D3e — Provider identity and provenance stay out of the canonical model

The following are **excluded** from `VendTransaction` and `VendTransactionLine`:

provider transaction IDs, provider selection IDs, artifact IDs, connection IDs,
ingestion-attempt IDs, parser versions, `source_artifact_id`,
`integration_connection_id`, `provider`, and `ingested_at`.

They are integration control-plane concerns, and they belong to Task 2:

```
SourceArtifact / IngestionAttempt
        │
ExternalIdentity / provenance mapping
        │
   canonical write boundary
        │
VendTransaction / VendTransactionLine
```

Reaffirming ADR-0002 D1c: **provider identifiers never become canonical
SmartVend primary keys**, and external transaction identity resolves through the
generic `ExternalIdentity` mechanism. That repository is not designed here.

`Machine.external_code` and `Machine.telemetry_device_id` remain
**PRE-EXISTING COMPATIBILITY FIELDS**: not removed, not synchronized, not
reinterpreted. Both are operator-entered free text with live UI consumers, so
neither carries a uniqueness or ownership guarantee and neither is
provider-verified identity.

### D3f — Machine, Slot, Product relationships and pricing

Approved as audited:

- `Machine → Slot` is 1:N, required, CASCADE
- `Slot → Product` is N:1, **optional**
- one `Product` may occupy many slots
- `Machine → Location` is N:1, **optional**

Pricing is **not redesigned**. Four layers, each with a distinct meaning:

| Layer | Meaning |
| --- | --- |
| `Product.sell_price` | Catalog / base price |
| `Slot.price_override` | Configured price for this machine selection |
| `Slot.dex_price` | Telemetry/provider-observed machine price; may drift |
| `VendTransactionLine.unit_price` | The **actual transacted value** |

### D3g — Organization ownership

```
Organization
├── User              explicit org_id (nullable for platform_admin only)
├── Location          explicit org_id
├── Product           explicit org_id
├── Machine           explicit org_id
│   └── Slot          inherited via machine_id (NOT NULL, CASCADE)
└── VendTransaction   explicit org_id
    └── VendTransactionLine   inherited via transaction_id (NOT NULL)
```

`VendTransaction` is a control-plane-adjacent **root** and carries explicit
`org_id`, per ADR-0002 D1a rule 1. `VendTransactionLine` inherits through a
mandatory, non-reparentable parent, which satisfies the structural-safety test.

**Provider payloads never select `org_id`.** Organization is resolved from the
authenticated principal or the resolved integration connection, never from
payload content.

## MVP debt, explicitly deferred

Recorded rather than solved. None of these block Seed Live transaction ingestion.

- **Inventory representations overlap**: `Slot.current_qty`/`par_level`/
  `capacity`, `MachineInventory`, and `InventoryBatch`/`InventoryLedger`.
  Normalization is not attempted in Task 1.
- **`payment_method` is `cash|cashless`** — too coarse for provider tender
  detail. Richer tender remains in the raw artifact until needed.
- **No currency column.** SmartVend operates single-currency today and the
  repository carries no multi-currency evidence. Accepted as MVP debt; a
  currency column is required before any second currency exists. Adding
  `total_amount` does **not** change this: the monetary value is stored, the
  unit is implicit, and making it explicit is the same deferred decision it was
  before.
- **No temporal binding history** for device-to-machine or selection-to-slot, so
  a historical event cannot be resolved against the planogram in force at the
  time.
- **`ReceiptLine.receipt_id` is nullable**, weakening that one inheritance path.
- **`daily_sales_summary` and `machine_inventory` have no writer.**
- **Dead columns**: `Machine.planogram_id` and `Sale.batch_id` are orphan UUIDs
  with no foreign key and no writer.
- **`api_rate_limits`** exists in `schema.sql` but has no ORM model.
- **13 declared models are unused** by any route or service.

## Consequences

- Integrations gain a stable canonical target that can accept a real Seed Live
  transaction, including a multi-item one, without discarding it.
- A second transaction representation now exists on paper alongside `sales`.
  This is contained only because `vend_transactions` is unimplemented and
  `sales` is unwritten. **Whichever is implemented first must come with the
  decision about the other**, or SmartVend acquires two sources of revenue truth.
- Nullable `product_id` means revenue reporting must handle unresolved lines
  explicitly rather than assuming a product join always succeeds. Unmapped lines
  are work items, never silent zeros.
- The canonical model can express external transaction identity structurally,
  but cannot yet resolve it. That remains Task 2.
- Revenue is read from `total_amount` at the header, so a transaction with no
  lines still counts. Per-product reporting still depends on lines, so a
  line-less or unresolved transaction contributes to revenue totals but not to
  product breakdowns. That asymmetry is deliberate and must be visible in
  reporting rather than hidden.
- Refund-aware aggregates must branch on `transaction_type`. Any query that sums
  `quantity * unit_price` without inspecting type will overstate revenue.

## What Task 1 does NOT implement

No SQLAlchemy model changes, no `schema.sql` changes, no migrations, no FastAPI
routes, no repositories, no integration persistence, no canonical write port, no
frontend changes, no `sales` migration, and no Seed Live parsers.

The canonical **write port** remains blocked per ADR-0002 D1b: no service or
repository layer exists in the application to design one against, and that
requires agreement with the application workstream owner.

## Revisit if

Accounting requires a richer refund lifecycle, which would reopen D3c. Or a
second currency appears, which forces the currency column. Or Seed Live
selection-to-product resolution becomes verified, which would let enrichment
populate `product_id` deterministically rather than leaving it unresolved.
