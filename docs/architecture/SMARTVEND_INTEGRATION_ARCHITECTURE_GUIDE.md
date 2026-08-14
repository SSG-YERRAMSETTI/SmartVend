# SmartVend integration architecture guide

A plain-English explanation of the terminology and mental model behind
SmartVend's provider-neutral integration architecture.

This is a **guide**, not a decision record. It explains *why* the architecture
exists and what each term means. Specific decisions and their consequences live
in architecture decision records, described in section 19.

It is written to be self-contained. You should not need any prior conversation
to follow it.

Throughout, four labels are used precisely:

| Label | Meaning |
| --- | --- |
| **CURRENT** | Exists in the repository today, verified |
| **TARGET** | Intended design, not built yet |
| **NOT YET IMPLEMENTED** | Explicitly absent, no code exists |
| **NOT VERIFIED** | We do not know; not established by evidence |

Last updated 2026-08-14.

---

## 1. What we are building

SmartVend receives data from external systems it does not control. Today and in
the foreseeable future those include:

- **Cantaloupe / Seed Live** — a live telemetry and payment provider
- **VendSoft** — a vending management system, used as a historical migration source
- **Nayax** — another payment and telemetry provider
- future providers not yet chosen

Each speaks its own dialect. Each names things differently. Each has its own
authentication, delivery mechanism, file formats, and failure behavior.

The integration platform exists to **safely receive, preserve, understand, map,
govern, and hand that data into SmartVend's own business domain**, without
letting any provider's idiosyncrasies leak into the core of the product.

```
Seed Live ─┐
Nayax ─────┼──>  Integration Control Plane  ──>  SmartVend Business Domain
VendSoft ──┘
```

The single most important idea in this document: **the left side is messy and
outside our control, the right side is ours and must stay clean.** Everything
else follows from keeping that boundary honest.

---

## 2. Tenant and Organization

**Multi-tenancy** means one running system serves many separate customers, and
none of them can see another's data. Each customer is a **tenant**.

**Tenant isolation** is the set of guarantees that keep them apart. It is not a
feature you add later; it is a property every query, cache key, and queue
message either has or does not.

SmartVend uses three related words, and it matters which is which:

| Term | What it is |
| --- | --- |
| **Tenant** | The *architectural concept*: one isolated customer |
| **Organization** | SmartVend's *concrete representation* of a tenant |
| **`org_id` / `organizations.id`** | The *concrete persistence identity*, a column and a table |

**CURRENT.** The database has an `organizations` table, and 24 columns named
`org_id` across the models reference it. There is no `tenant_id` column
anywhere, and no separate tenant entity. Organization **is** the tenant.

**Decision, recorded in ADR-0002:** "tenant" stays the architectural word.
"Organization" is its SmartVend representation. `org_id` is the persistence
identity. We do **not** introduce a second Tenant entity beside Organization,
because two names for one thing is how systems end up with two sources of truth.

### Why provider payloads must never select their own organization

Suppose two fictional customers, *Northwind Vending* and *Contoso Refreshments*,
both use the same provider. A delivery arrives containing a field that looks
like a customer name.

If SmartVend read ownership from inside that payload, then anyone who could
craft a payload could write into any organization's data. The payload is
attacker-influenced input; it cannot also be the authority on who owns the
result.

Instead, ownership is decided **before** the payload is opened, by the
connection the request authenticated against (section 4). Northwind's
connection can only ever write Northwind's data, regardless of what the bytes
inside claim.

**Rule: organization context derives from the resolved connection, never from
provider payload content.**

---

## 3. Provider

A **provider** is an external system that supplies data or functionality to
SmartVend.

Examples: Cantaloupe / Seed Live, Nayax, VendSoft.

Providers are **not** interchangeable and do not expose equivalent
capabilities. One may push files over HTTP on a schedule; another may offer a
polling API; another may only produce manual exports. Treating them as uniform
is a mistake the architecture is specifically designed to avoid: the *contracts*
are uniform, the *providers* are not.

---

## 4. Integration connection

A provider and a connection are different things, and conflating them is the
most common modelling error in this area.

- **Provider:** "Cantaloupe". One per external system. There is one of these.
- **Connection:** "Northwind Vending's configured Cantaloupe relationship".
  One per customer-provider pairing. There are many of these.

```
Cantaloupe (provider)
    ├── connection: Northwind Vending
    ├── connection: Contoso Refreshments
    └── connection: Fabrikam Snacks
```

Hundreds of customers means hundreds of **connection records**, and still only
one Cantaloupe connector (section 5). Customer-specific behavior lives in
configuration, never in code. If adding a customer requires writing code, the
design has failed.

Several things are **connection-scoped** rather than provider-scoped:

- **Authentication.** Each customer has their own credential.
- **Ownership.** Each connection belongs to exactly one organization.
- **Configuration.** Provider settings differ per customer.
- **Idempotency** (section 12). Two customers can legitimately receive
  byte-identical files; those must not be mistaken for duplicates of each other.

**CURRENT.** An `IntegrationConnection` value object exists in
`backend/integrations/connections.py`. It is an in-memory contract only; there
is no database table for it. **NOT YET IMPLEMENTED:** connection persistence.

---

## 5. Connector

A **connector** is provider-specific code that implements one provider's
behavior behind SmartVend's provider-neutral contracts.

```
        Provider-neutral integration interfaces
                        |
        ┌───────────────┼────────────────┐
CantaloupeConnector  NayaxConnector  future connectors
```

The interfaces above the line never mention a provider. The classes below the
line contain all the provider-specific knowledge: how to identify a report, how
to parse it, what its quirks are.

This is what makes a second provider cheap. Adding Nayax should mean adding one
class, not a second pipeline.

**CURRENT.** `CantaloupeConnector` exists and can identify report types. Its
parser deliberately refuses to run, because no Seed Live report schema has been
verified. Refusing is correct: a parser written against a guessed schema would
silently produce wrong business data, which is worse than no parser.

---

## 6. Endpoint, payload, transport metadata

| Term | Meaning |
| --- | --- |
| **Endpoint** (or **route**) | A URL that SmartVend exposes and a provider sends to |
| **Payload** | The raw bytes in the body of that request |
| **Transport metadata** | The HTTP-level information accompanying the delivery: headers, content type, size, timestamps |

**HTTP** is HyperText Transfer Protocol, the request-and-response protocol the
web runs on.

SmartVend's Cantaloupe endpoint is
`POST /integrations/cantaloupe/{connection_id}/reports`. It is
provider-specific by design: Seed Live never sees SmartVend's canonical model,
and the canonical model is never shaped by a provider's wire format.

**CURRENT.** The route exists and is fully tested but is **deliberately not
registered** in the running application, because several preconditions are
unmet, including persistence and verified real-delivery behavior.

Restating the rule from section 2, because it is the one that matters most
here: **payload content never determines organization ownership.** The
`{connection_id}` in the URL is resolved to a connection, that connection
carries the organization, and the bytes are opened afterwards.

---

## 7. Artifact, raw artifact, evidence

One of the central principles: **the original provider delivery is evidence.**

```
Provider
   |
raw payload (exact bytes)
   |
preserve immutable original      <-- happens first
   |
SHA-256 + metadata recorded
   |
parse later                      <-- happens separately, and may be redone
```

**SHA-256** is a cryptographic hash function: it turns any input into a
fixed-length fingerprint. The same bytes always produce the same fingerprint,
and any change produces a different one. It lets us prove a stored file is
byte-identical to what arrived.

Key terms:

| Term | Meaning |
| --- | --- |
| **Raw artifact** | The exact bytes a provider sent, stored unchanged |
| **Immutable evidence** | Once written, never edited. Corrections create a new artifact that supersedes the old one |
| **Storage reference** | A pointer to where those bytes live, intended to be object storage |
| **Parser version** | Which version of our parsing code produced a given interpretation |
| **Replay** | Re-processing a stored artifact to regenerate derived records |
| **Auditability** | The ability to answer "why does this record say that?" by going back to the source |

**Why this matters.** Parsers improve. We will misread a field, fix it, and
need to re-derive months of records. If we kept only our interpretation, that
correction would be impossible and the error would be permanent.

**Parsed records may change as parsers improve. The original evidence does
not.** Never mutate a stored artifact to reflect a later parsing decision.

**CURRENT.** The artifact contract and byte-exact hashing exist in
`backend/integrations/`. **NOT YET IMPLEMENTED:** artifact persistence and
object storage.

---

## 8. Canonical data

**Canonical** means SmartVend's own single agreed representation of a business
concept, independent of any provider.

The same physical vending machine may be called different things by different
systems:

```
Seed Live  calls it a "Device"
Nayax      calls it a "Machine"
VendSoft   has its own machine identifier

                    ↓ all map to ↓

            SmartVend Machine
```

We deliberately do **not** create provider-shaped copies such as
`SeedLiveMachine`, `NayaxMachine`, or `VendSoftMachine`.

The reason is concrete. With three provider-specific machine models, every
question becomes three questions: reporting has to union three tables, a
machine that reports through two providers exists twice with no way to know
they are the same, and adding a fourth provider means touching everything.

The narrow exception: if a provider concept genuinely has **no** canonical
equivalent, model it as provider-specific rather than distorting the canonical
model to accommodate it. That exception should be rare and argued for
explicitly, not assumed.

---

## 9. Control plane versus business domain

This is the boundary the whole architecture is organised around.

The **control plane** is about *the integration itself*. It answers:

- Which provider is connected?
- Which organization owns this connection?
- Which credential reference applies?
- Did we receive this payload?
- Has it already been processed?
- Which external identifier maps to which SmartVend entity?
- Did processing fail, and why?
- Can it be replayed?
- Is the connection healthy?

The **business domain** is about *the operator's actual business*:

- machines, locations, products, slots
- sales and transactions
- refunds
- and the rest of SmartVend's operational records

**CURRENT.** The business domain already exists: 37 SQLAlchemy models including
`machines`, `locations`, `products`, `slots`, `sales`, and `telemetry_events`.
It is owned by the SmartVend application workstream.

**Rule: integration and control-plane data must never become a competing copy
of canonical business data.** The control plane may *reference* canonical
identifiers. It must not own a second machine table, a second product table, or
a second transaction table.

---

## 10. External identity

An **external identity** is how some outside system refers to a thing that
SmartVend also knows about.

```
SmartVend Machine 847
    ├── Seed Live refers to it as external device A
    ├── Nayax     refers to it as external device B
    └── VendSoft  refers to it as external machine C
```

All four names describe one physical machine.

| Term | Meaning |
| --- | --- |
| **External ID** | The identifier a provider uses |
| **Internal / canonical ID** | SmartVend's own identifier, which we control |
| **Crosswalk** | A lookup table connecting the two |
| **Mapping** | One row in that crosswalk |

**Rule: external provider identifiers are never SmartVend primary keys.**

A primary key is the identity a database row is known by, and everything else
points at it. If a provider's identifier became a SmartVend primary key, then a
provider could rename, reissue, or collide their identifiers and we would be
unable to fix our own data. We would have handed control of our identity model
to a third party. External identifiers are *attributes we record*, never
identity we depend on.

---

## 11. The external identity crosswalk

**TARGET.** The generic shape:

| Field | Purpose |
| --- | --- |
| `org_id` | Which organization owns this mapping |
| `provider` | Which external system |
| `connection_id` | Which specific customer-provider relationship observed it |
| `entity_type` | What kind of thing, for example machine, product, location |
| `external_id` | The provider's identifier, stored as text |
| `mapping_state` | See below |
| `canonical_entity_type` | Which SmartVend entity kind it maps to |
| `canonical_entity_id` | Which specific SmartVend record |
| source / evidence | Which artifact this mapping was observed in |

Mapping states:

| State | Meaning |
| --- | --- |
| **UNRESOLVED** | We have seen this external identifier but do not yet know which SmartVend record it is |
| **RESOLVED** | Confidently mapped to a specific canonical record |
| **AMBIGUOUS** | Could plausibly match more than one canonical record; needs a decision |

Modelling all three states matters. A system that can only express "mapped" is
forced to either guess or silently discard, and both corrupt data quietly. An
unresolved mapping is a visible work item; a wrong mapping is an invisible
defect.

### Why external identifiers cannot be assumed globally unique

There is no rule compelling two providers, or two customers of one provider, to
use different identifiers. Provider identifiers are often small integers or
short codes, and are frequently unique only within one account.

**Initial uniqueness direction, from ADR-0002:**
`(connection_id, entity_type, external_id)`. The connection scope carries both
the organization and the provider, so it prevents cross-tenant and
cross-provider collisions in one key.

**NOT VERIFIED.** Whether any specific provider identifier is stable or unique
beyond one account. For Cantaloupe specifically, the transaction identifier
observed in one export was unique *within that export*, which does not
establish global uniqueness.

### Pre-existing compatibility fields

**CURRENT.** The `machines` table already carries two fields that do a narrow
version of this job:

- `Machine.external_code`
- `Machine.telemetry_device_id`

Both are plain text columns on the canonical row. They hold one value each, are
not scoped by provider, and carry no mapping state.

They are classified as **PRE-EXISTING COMPATIBILITY FIELDS**. They are not the
generic external identity solution, and new integrations do not use them. They
are also **not** to be removed or changed on the strength of this document:
they appear in the API schemas, so they have consumers. Their semantics and
consumers must be **inventoried** before any deprecation, synchronization, or
migration decision.

---

## 12. Idempotency

**Idempotent** means doing something twice has the same effect as doing it once.

This matters because providers resend. Networks time out after the server
already succeeded. A retry arrives. An operator clicks twice. If SmartVend
recorded the same day's sales twice, every downstream number would be wrong.

**Worked example.** Seed Live sends a transaction report. Our server stores it
and starts replying, but the connection drops before the reply arrives. Seed
Live believes the delivery failed and sends the identical file again. SmartVend
must recognise the second delivery as the same thing and not double-count.

Three distinct notions of "the same", which are **not** equivalent:

| Level | Question | Basis |
| --- | --- | --- |
| **A. Raw artifact equality** | Are these the exact same bytes? | SHA-256 of the payload |
| **B. Provider delivery identity** | Is this the same delivery event? | Provider-supplied delivery identifiers, if any |
| **C. Canonical transaction identity** | Is this the same business transaction? | Canonical business keys |

Why the distinction matters: a provider might resend the same delivery with
slightly different bytes, such as a regenerated timestamp in a header row. That
breaks A while B and C still hold. Conversely, two genuinely different
deliveries might contain overlapping transactions, so B differs while C
overlaps.

**CURRENT.** Only level A is implemented, and only that level is supported by
evidence: byte-exact SHA-256 over the payload, combined with the connection
scope so two customers receiving identical files are not confused for each
other.

**NOT VERIFIED.** Level B for Cantaloupe: no real generated delivery has ever
been captured. Level C: canonical transaction identity depends on provider
identifier uniqueness that is unproven.

The contracts are designed so provider-specific strategies for B and C can be
added later **without redesigning storage**.

---

## 13. Persistence

**Persistence** means saving state durably, so it survives a restart.

**TARGET** responsibilities. None of the cloud components below are built yet.

| Component | Holds |
| --- | --- |
| **PostgreSQL / RDS** | Connection metadata, external identity crosswalks, artifact metadata, idempotency records, ingestion state, reconciliation state, and the canonical business records |
| **S3** | Immutable raw artifacts, the actual provider bytes |
| **Secrets Manager** | Secret values |
| **SQS** | Asynchronous work handoff, later |
| **CloudWatch** | Operational monitoring, later |

Acronyms: **RDS** is Amazon Relational Database Service, managed PostgreSQL.
**S3** is Amazon Simple Storage Service, object storage for files. **Secrets
Manager** stores credentials outside the database. **SQS** is Amazon Simple
Queue Service. **CloudWatch** is Amazon's monitoring service.

**NOT YET IMPLEMENTED.** No AWS service is in use. There is no AWS account
configuration, no infrastructure code, and no AWS software library anywhere in
the repository. Everything in this section is direction, not description.

The split is deliberate: metadata is small, queryable, and belongs in a
database; raw artifacts are large, immutable, and belong in object storage;
secrets belong in neither.

---

## 14. Repository (the pattern, not Git)

In this context, **repository does not mean a Git repository.** It is a design
pattern: an interface for storing and retrieving data that hides *how* and
*where* the data is stored.

Examples: `ArtifactRepository`, `ConnectionRepository`,
`ExternalIdentityRepository`.

The point is that integration logic asks for what it needs — "give me the
connection with this identifier" — without knowing whether the answer comes
from PostgreSQL, an in-memory dictionary, or a test fixture. That keeps the
logic testable without a database and lets the storage technology change
without rewriting the logic.

**NOT YET IMPLEMENTED.** These interfaces are named here as direction. They are
not written.

---

## 15. Application write boundary, and ports

Provider integration code should **not** reach directly into SmartVend's
canonical tables and write to them.

```
Provider
   |
Connector                  (provider-specific)
   |
Parser                     (provider-specific)
   |
Canonical transformation   (provider-neutral)
   |
SmartVend application write boundary   <-- the seam
   |
Canonical persistence      (owned by the application workstream)
```

| Term | Meaning |
| --- | --- |
| **Port** | A narrow interface one part of the system offers to another. The integration side calls the port; the application side implements it |
| **Write boundary** | The single controlled place where canonical business records are created or changed |
| **Dependency inversion** | Both sides depend on the shared interface rather than on each other's internals, so either can change independently |

Why it matters practically: business rules, validation, and invariants live on
the application side. If integration code wrote rows directly, it would have to
duplicate those rules, and the two copies would drift. A single write boundary
means one place enforces correctness, and integration cannot accidentally
bypass it.

**CURRENT.** There is no such boundary. The application has no repository or
service layer; route handlers call the database session directly. That is a
known gap recorded in ADR-0002, and defining the port is deliberately deferred
because the application side owns that decision.

**NOT YET IMPLEMENTED.** The port itself.

---

## 16. Credential and credential reference

| Term | Meaning |
| --- | --- |
| **Credential** | The actual secret, for example a username and password |
| **Credential reference** | A pointer saying *where* the secret is stored, which is not itself secret |

```
connection record
    holds  credential_ref  ─────>  Secrets Manager  ─────>  actual username/password
```

The database row holds only the pointer. The secret is fetched at the moment it
is needed and is never written into an integration table, a log, an error
message, or a stored artifact.

**Rule: new integration secrets are not stored directly in integration database
rows.** AWS Secrets Manager is the intended production direction.

**CURRENT.** `IntegrationConnection` carries a `credential_ref` and never a
secret value, and the credential provider contract exists.
**NOT YET IMPLEMENTED:** any secret store.

**Pre-existing security debt.** The `webhooks` table stores a secret value
directly in a `secret` column. That predates this architecture, belongs to the
application workstream, and is recorded rather than changed here.

---

## 17. Queue

A **queue** lets work be accepted now and processed later.

Without one, receiving and processing are welded together: a slow parser makes
the provider's request time out, and a parser crash loses the delivery. With
one, the endpoint stores the raw evidence, puts a note on the queue, and
answers immediately. A worker picks it up afterwards. If the worker fails, the
evidence is still there and the work can be retried.

That decoupling is the point: **receiving must be fast and reliable; processing
can be slow and fallible.**

Queue delivery is normally *at-least-once*, meaning the same message may be
delivered more than once, which is precisely why idempotency (section 12) is
mandatory rather than optional.

**NOT YET IMPLEMENTED.** There is no queue. SQS is the intended direction.

---

## 18. Orchestrator

An **orchestrator** coordinates a sequence of deterministic steps and knows
what should happen next.

```
receive -> preserve -> identify -> parse -> map -> write -> reconcile -> report gaps
```

**Deterministic** means the same inputs always produce the same outputs, with
no randomness and no judgement.

A language model, such as one accessed through Amazon Bedrock, may later assist
with the *judgement-shaped* parts: suggesting which external identifier
probably matches which machine, classifying an unfamiliar dataset, or
explaining a conflict in human terms.

**It may not be the authority on anything that must be exactly right.** Counts,
totals, duplicate detection, referential integrity, and whether a migration is
complete are decided by deterministic code. A model may propose; code and
humans dispose. A proposed mapping is marked as proposed and is not trusted
until confirmed.

**NOT YET IMPLEMENTED.** No orchestrator, and no language model in any
integration path.

---

## 19. ADR — Architecture Decision Record

An **ADR** is a short document recording one significant decision: the context
that forced it, what was decided, and the consequences accepted.

The difference in one line: **this guide teaches concepts; ADRs record
decisions.** If you want to know what "crosswalk" means, read section 11. If
you want to know why the uniqueness key is scoped by connection and who decided
that, read the ADR.

ADRs are append-only. A superseded decision is marked superseded, not deleted,
because the history of why matters as much as the current answer.

Project ADRs live in `.evo/project/decisions/` and in this directory.

---

## 20. Current development position

### Already established

- Target architecture direction and the control-plane / business-domain split
- Provider-neutral inbound scaffold
- Raw artifact abstraction with byte-exact hashing
- Connection abstraction
- Idempotency foundation at the raw-artifact level
- Seed Live discovery: authentication mechanism, Test Transport wire behavior,
  a real transaction-level dataset, and the limits of what that account can show
- HTTP Basic authentication boundary, implemented and tested offline

### Currently deciding or designing

- The integration persistence boundary
- Organization and tenant ownership semantics
- The external identity crosswalk
- The canonical application write boundary

### Not yet implemented

- Production persistence for any integration record
- S3, SQS, and Secrets Manager
- Route registration
- Live report parser
- Machine and product mappings
- Generic provider connector SDK, meaning a reusable software development kit
  for building connectors
- Orchestrator
- Bedrock assistance
- Pilot cutover

### Not verified

- Real generated-report delivery behavior for Cantaloupe, including wire
  format, report identification, and retry
- Whether Cantaloupe transaction identifiers are unique beyond a single export
- What the Cantaloupe selection codes correspond to in product terms
- The timezone and currency conventions in Cantaloupe report data
