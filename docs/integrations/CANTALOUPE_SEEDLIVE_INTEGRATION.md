# Cantaloupe / Seed Live integration

Provider discovery and integration contract for the live telemetry and payment
provider.

- Date: 2026-08-12
- Branch: `feat/seedlive-integration`
- Owner: Angel, Platform Architecture and Seed Live Integration workstream
- Gameplan: `../gameplans/SMARTVEND_PLATFORM_ARCHITECTURE_AND_SEEDLIVE_MVP.md`

Evidence levels used throughout. They are not decorative: nothing marked below
VERIFIED may be relied on in code.

| Level | Meaning |
| --- | --- |
| **VERIFIED** | Observed directly in the Seed Live product or in this repository |
| **INFERRED** | A reasonable reading of verified facts, not confirmed |
| **NOT YET VERIFIED** | Unknown. Must not be assumed in code |
| **REQUIRES LIVE TEST** | Can only be settled by a real provider delivery |

## 1. Verified

Observed in the Seed Live product.

- Seed Live supports report delivery through the **Report Register**.
- The configuration path is **Reports -> Report Register -> Add Transport**.
- **HTTP POST is available as a transport type.**
- Existing VendSoft integrations were observed using an HTTP transport, so the
  mechanism is in real use and not theoretical.
- The Report Register exposes **scheduling** and **transport status and error
  information**, so the provider surfaces delivery health on its own side.
- Reports available include:
  - Single Transaction Data Export (CSV)
  - Transaction Line Item Data Export
  - DEX File
  - refund-related reports
  - terminal and device-related reports
  - payment reconciliation and fee-related reports
  - further configurable reports
- **Delivery is live only.** Once configured, a transport sends **new** data.
  It is not a historical backfill mechanism.
- Reports can also be built and retrieved interactively through **Build a
  Report -> Simple Report**, and historical files retrieved through **Report
  Register -> Sent Reports -> File Name**. These are separate from transport
  delivery and are how discovery evidence has been obtained so far.
- **The account holds real transaction history, in September 2025.** See
  section 10A.

## 1A. Test Transport session, 2026-08-12 and 2026-08-13

Six genuine Seed Live deliveries were captured through a temporary Cloudflare
tunnel into a standalone capture harness. Raw evidence is held locally under
`data/seedlive/`, which is gitignored and must never be committed.

Genuine Seed Live traffic is identifiable by three corroborating signals:
User-Agent `Apache-HttpClient/4.5.14 (Java/17.0.19)`, New Relic and W3C
trace-context headers, and the appended `testTransportFileName` path segment.
Two operator preflight requests in the same capture set are excluded from every
finding below.

### VERIFIED

| Finding | Evidence |
| --- | --- |
| Method is `POST` | all six deliveries |
| **A Test Transport** appends the literal segment `testTransportFileName` to the configured URL path | configured 4 segments, received 5 |
| **A Test Transport** adds the query parameter `reason=TEST` | all six |
| **No report-type header was observed** on any Test Transport | no `Content-Type`, no `Content-Disposition`, no report header |
| **No `Content-Type` is sent at all** | all six |
| **No `Content-Disposition` is sent** | all six |
| Authentication is **HTTP Basic**, matching RFC 7617 framing | scheme token `Basic`, valid base64, decoded form contains a colon |
| Blank Username and Password send **no** `Authorization` header | deliveries with blank fields carried none |
| The tunnel preserves `Authorization` intact | operator preflight confirmed, so absence is Seed Live's behavior, not tunnel stripping |
| **HTTP 200 is accepted as success** | Seed Live reported "Transport Result Success: 200" |
| The Test Transport payload is a **fixed 33-byte plain-text string** | identical SHA-256 across all six deliveries |
| `As Zip File` changes **nothing** on the wire for a Test Transport | byte-identical request before and after enabling it |
| The Test Transport does **not** exercise report generation | credential changes propagated, zip setting did not |
| Registering a report against a transport does **not** by itself trigger a real delivery | `Single Transaction Data Export -> SmartVend Discovery Test` produced only Test Transports |
| The **saved** transport sends no `Authorization` header | credentials entered in the unsaved form did not persist into the registered transport |
| A concurrent pair of deliveries occurred 0.217s apart | distinct `Cf-Ray` and `Traceparent`, so two separate HTTP requests |

### INFERRED ONLY

- The 0.217s pair was caused by **two different configured transports** firing
  at once. Two distinct requests are proven; their origin is not.
- A real report will substitute an actual filename for `testTransportFileName`.
- `As Zip File` applies at the file-generation layer that a Test Transport
  never reaches.

### NOT VERIFIED

- **How a real delivery identifies its report.** Everything observed about the
  path and query comes from a *Test Transport*. It is **not** established that
  a real report appends its actual filename, that any appended filename
  identifies the report type, or that report type is conveyed anywhere at all
  on a real delivery. Test Transport behavior must not be generalized into the
  real delivery contract.
- **Multiple transports can coexist.** The concurrent pair is consistent with
  this but does not establish it. Two requests may have originated from one
  transport.
- Whether a real delivery sets `Content-Type`.
- Whether `202` or any 2xx other than 200 is accepted.
- Retry behavior. See the note below.

### Note on the identical payloads

Precisely what is and is not established:

- **VERIFIED** the requests were distinct HTTP deliveries, each with its own
  `Cf-Ray` and `Traceparent`.
- **VERIFIED** all received HTTP 200.
- **VERIFIED** their payloads were byte-identical.
- **NOT VERIFIED** whether any were provider retries, duplicate Test Transport
  executions, or some other internal Seed Live delivery behavior.

Failure-triggered behavior has since been tested **for a Test Transport**: a
500 produces no retry within three minutes, section 1A.1. That does not explain
the identical payloads above, which all received 200, and it establishes
nothing about a **real generated report delivery**, which remains untested.

## 1A.1 Test Transport failure response, 2026-08-14

A controlled failure experiment: the capture harness returned HTTP 500 to the
first request, and would have returned 200 to any subsequent one. Observation
window exceeded three minutes.

### VERIFIED FOR TEST TRANSPORT

| Finding | Evidence |
| --- | --- |
| **HTTP 500 is treated as a Test Transport failure** | Seed Live UI: `Transport Status: Invalid` |
| The provider reports the failure with the status it received | UI: `Failure: TransportException:POST Request was not successful: 500 -` |
| The UI marked the transport **Invalid immediately** | observed at the time of the request |
| **Exactly one request was observed** | a single capture, sequence 001, on a freshly started listener |
| **No automatic retry occurred within a window exceeding three minutes** | no second capture arrived |
| No later HTTP 200 occurred, and the transport did **not** recover on its own | the harness was armed to return 200 to a second request; none came |
| The failing request was otherwise identical to every prior Test Transport | same method, path `/…/testTransportFileName`, query `reason=TEST`, and byte-identical 33-byte payload, SHA-256 `b82bfa2f…` |
| No `Authorization` header was sent | consistent with the saved transport carrying no credentials |

Method note: the listener was started fresh so its sequence counter began at 1,
and no preflight request was sent through the tunnel. The 500 was therefore
served to Seed Live and not consumed by unrelated traffic.

### NOT VERIFIED FOR REAL GENERATED REPORT DELIVERY

Nothing above may be carried across to a real delivery. A Test Transport posts
a fixed synthetic string and does not exercise report generation, and its HTTP
client behavior has not been shown to match a real delivery's.

Specifically unresolved for real deliveries:

- whether a 500 triggers a retry at all
- retry count
- retry interval or backoff
- whether 5xx is preferable to 4xx for delivery semantics
- whether real report delivery uses the same HTTP client behavior as Test
  Transport

### Consequence for the authentication backend response

**This experiment does not justify changing
`BACKEND_UNAVAILABLE_STATUS_PROVISIONAL`.**

The reasoning is unchanged: the provisional 404 exists to preserve enumeration
protection, and the argument against it is that a real delivery should be
retried after our secret store recovers. This experiment says nothing about
real deliveries, so the trade-off it was blocked on is still unmeasured.

The production response policy for an authentication-backend outage therefore
**remains unresolved**, and 404 remains provisional.

## 1B. Transaction-level evidence, 2026-08-13

The first genuine transaction-level dataset. Obtained through
**Reports -> Payments -> Transactions in Payment -> historical payment batch**,
exported as CSV. Raw file held under `data/seedlive/historical/`, gitignored.

This is the strongest Seed Live evidence we hold. The classifications below are
deliberately tight, because it will be used for canonical design and an
over-claim here propagates into the schema.

**This is a UI export, not a transport delivery.** The schema recorded here is
the shape of a file downloaded from the Payments screen. The schema of a report
**delivered over an HTTP transport** remains **NOT VERIFIED**, along with the
rest of the real delivery wire contract, and no delivered report has ever been
obtained. **Do not assume the two are the same shape.** A parser written for
the live path must be built against a captured delivery, not against this file.

### File and shape

| | |
| --- | --- |
| Size | 345,319 bytes |
| Encoding | UTF-8, no BOM, LF line endings |
| Structure | flat, 16 columns, 1,586 data rows, no ragged rows |

Columns, in order:

`Reference #`, `Reconcile Group`, `Trans Type`, `Settle State`, `Tran #`,
`Device`, `Terminal`, `Location`, `Asset #`, `Client`, `Date`, `Card Type`,
`Amount`, `AP Code`, `Details`, `Batch #`

**The CSV carries four columns the UI did not display**: `Reference #`,
`Reconcile Group`, `Trans Type`, `Settle State`.

### VERIFIED

- Rows are transaction-level: unique per-row identifier, per-row timestamp and
  amount, zero identical rows, and zero identical even ignoring `Tran #` and
  `Reference #`.
- `Tran #` is populated on all 1,586 rows, 11 digits, and **unique within this
  payment export**.
- `Date` format is `MM/DD/YYYY hh:mm:ss AM/PM`, 12-hour with meridiem, always
  carrying a time component. Rows are not date-sorted.
- **No timezone is represented anywhere in the data.**
- `Device` is 11 characters, 12 distinct. `Terminal` is 9 characters, 12
  distinct. **Strict 1:1 correspondence within this export.**
- `Location` and `Asset #` each hold exactly one distinct value in this export.
- `Trans Type` has 7 values, spanning card, mobile-wallet, cash, and one
  refund. `Settle State` has 2. `Card Type` has 15 distinct tender labels.
- `Amount` is a `$9.99` string with an embedded currency symbol and always 2
  decimals. Negatives use a leading minus. **No currency code column exists.**
- `AP Code` is populated on every non-cash row and blank on every cash row in
  this export. Where present it is 6 characters (one at 8), mixed alphanumeric,
  and 99.61% unique among non-blank values.
- The blank-`AP Code`, `Trans Type = Cash`, and `Settle State = Processed` sets
  are **identical**, exactly 288 rows each, with no non-cash row missing an
  `AP Code`.
- `Details` is a composite field that **tokenizes deterministically**: all 2,730
  items across 1,585 rows parsed against `token($price)` or
  `token(qty * $price)` with zero failures. Item counts per row range 1 to 4.
  Fifty items carry an explicit quantity multiplier.
- `Details` yields 134 short code-like tokens of 4 characters or fewer, plus one
  long name-like token. Short codes number 12 to 34 per device, 91 of 134 appear
  on more than one device, and 70 of 134 carry a single consistent price. These
  repeat in patterns **consistent with vending selections**.
- `Batch #` is 8 digits, 7 distinct, each mapping to exactly one `Reference #`,
  and batches are **not** confined to a single calendar day.
- `Reference #` is 10 digits and constant across every row.
- `Reconcile Group` and `Client` are 100% blank.
- Date coverage is 2025-09-19 to 2025-09-26, 8 distinct days, including the
  confirmed-active date.
- The CSV contains **1,586 rows across the observed date range**.

### INFERRED

- `Device` and `Terminal` may be two identifier systems for the same physical
  unit.
- `AP Code` is **likely payment or authorization related**. The pattern of
  presence only on card tender, combined with near-total uniqueness, is
  inconsistent with a selection or slot code.
- The short `Details` tokens are **likely vending selection identifiers**.
- The single long `Details` token is one named non-selection line item.

### NOT VERIFIED

- **`Tran #` global uniqueness.** Uniqueness is established *within this payment
  export only*. Whether it is unique across all Seed Live history, or across
  operators and accounts, is unknown. Treat it as the **leading provider
  transaction external-ID candidate, not a proven global natural key.**
- **That Device-to-Terminal 1:1 holds across the operator's full history.**
  Only this export is evidence.
- **`AP Code` semantics.** Whether it is an authorization identifier, and
  whether it is stable or reusable as an external identity, is unknown.
  **Do not build an AP-code identity model.**
- **That the `Details` short codes are MDB selection numbers, planogram slot
  identifiers, or product identifiers.** They must not be called MDB codes, and
  **the selection crosswalk must not be finalized until planogram or product
  evidence exists.**
- **Whether the CSV export covers all UI pages.** The UI showed 4 pages; we have
  not compared against a known UI total or count. Row count alone does not
  establish coverage.
- The meaning of `Asset #`, `Reconcile Group`, `Client`, and the distinction
  between `Settled` and `Processed` beyond its correlation with tender.
- Timezone and currency. Neither is derivable from this data.
- Whether one location and one asset is a property of the account or of this
  particular payment.

### 1B.1 Provisional provider-neutral transaction contract

**PROVISIONAL. Not a schema. No migration follows from this.** It records what
this evidence supports, so canonical design can proceed without waiting on the
unresolved items.

**This is the INTEGRATION / CONTROL-PLANE view of a delivered transaction, not
the canonical business entity.** Written before ADR-0003; read it alongside
that ADR, which is authoritative for the canonical model. Specifically:

- The provider, connection, artifact, ingestion and idempotency fields below
  are **control-plane** data. ADR-0003 D3e explicitly **excludes** them from
  `VendTransaction` and `VendTransactionLine`.
- The provider transaction, device and terminal identifiers resolve through the
  `ExternalIdentity` crosswalk and **never** become canonical primary keys.
- "signed amount, sign preserved" applies **at the provider boundary only**.
  The canonical model stores positive magnitudes and carries SALE versus REFUND
  meaning in `transaction_type`, never in the sign.
- Canonically, this maps to one `VendTransaction` header plus `0..N`
  `VendTransactionLine` records; the `Details` line-item collection below is
  what would populate those lines when it can be parsed.

| Field | Notes |
| --- | --- |
| SmartVend internal transaction ID | SmartVend-owned primary key |
| tenant / operator ID | resolved from the connection, never from payload |
| provider | `cantaloupe` |
| provider transaction external ID | from `Tran #`. Candidate, not a proven global key |
| connection ID | the customer-provider relationship |
| machine / device mapping reference | resolved via crosswalk, not stored raw |
| provider device identifier | from `Device` |
| provider terminal identifier | from `Terminal` |
| transaction timestamp as supplied | stored as provided, unconverted |
| timezone status | **unresolved**, recorded as such |
| transaction / tender type | from `Trans Type` |
| settlement state | from `Settle State` |
| signed amount | from `Amount`, sign preserved |
| currency status | **unresolved**, no currency code in source |
| provider payment / reference metadata | from `Reference #` |
| batch / settlement grouping | from `Batch #` |
| raw artifact reference | link to the preserved source artifact |
| source row reference | position or identifier within the artifact |
| line-item collection | from `Details`, **provisionally parsed** |
| ingestion / idempotency metadata | hash, idempotency key, received timestamp |

Binding rule, unchanged: **external provider identifiers remain crosswalk
external identities and never become SmartVend primary keys.**

## 1C. UI capability survey and the selection-to-product dead end

**VERIFIED 2026-08-13.** A survey of the Seed Live UI establishes what this
account can and cannot provide. This closes the discovery phase for this
account: further probing of unrelated UI areas is not warranted.

### What the UI exposes

| Area | What it provides |
| --- | --- |
| Administration | **Only** W-9, Complete Order, Refunds, Regions, Campus Cards. **No device, machine, product, planogram, coil, selection, or inventory configuration.** |
| Device Management | RMA and transfer functions only |
| Configuration | No product, planogram, or selection management |
| DEX Status | **No data** for the known-active September 2025 period |
| Payments | **Transaction-level historical rows.** The one productive source, see section 1B |
| Sprout Transaction Line Item Data Export | Advertises `Coil Name`, `Price`, `Quantity` and similar. **This dormant account has no Daily Export batch available to produce a sample.** |
| Historical Payments `Details` | Parseable item-like codes, semantics unresolved |

### Classification of the selection-to-product question

| Item | Status |
| --- | --- |
| Selection to product resolution | **NOT VERIFIED** |
| `Details` short codes | **INFERRED** likely selection identifiers only |
| `Coil Name` | **VERIFIED** as an advertised Sprout export field. **NOT VERIFIED** against the `Details` short codes |
| MDB interpretation | **NOT VERIFIED** |

`Coil Name` and the `Details` short codes have **not** been shown to be the same
thing. They come from different reports, and no sample of the former exists.

### Conclusion

**This account cannot provide enough evidence to complete the selection and
product mapping.** The one report that advertises the required fields cannot be
produced here, because the account is dormant and has no Daily Export batch.

Continuing to probe this account's UI will not resolve it. Stop.

### Explicit dependency for resolution

Resolution requires **one** of:

1. A currently active Seed Live account producing Sprout Transaction Line Item
   Data Export.
2. A provider-supplied sample file or file specification.
3. A planogram or product export from Cantaloupe / Seed Live.
4. Another authorized customer account with usable line-item history.

Until one of these exists, the selection crosswalk cannot be finalized, and any
code that maps a `Details` token to a product would be invention.

## 2. Consequences of the live-only limitation

This is the single most important architectural consequence of the verified
facts, so it is stated separately.

Seed Live will not replay history through a newly configured transport. Any
pre-existing transaction history for a customer must therefore come from:

- the historical migration control plane, VendSoft or another VMS, or
- a separate Seed Live export mechanism, if one exists. **NOT YET VERIFIED.**

Onboarding a customer must not assume that configuring a live transport
backfills anything. The Migration Coverage Manifest must treat live-provider
history as a distinct dataset from live-provider ongoing delivery.

## 3. Inferred

Reasonable readings of the verified facts. None is safe to implement against.

- Because HTTP POST is a transport type and existing integrations use it, Seed
  Live can be pointed at an arbitrary HTTPS endpoint we control. **INFERRED.**
- Because the Report Register schedules reports, delivery is likely to be
  batch on a schedule rather than per-transaction streaming. **INFERRED.**
- Because a Single Transaction Data Export is offered as CSV, at least some
  report bodies are likely CSV rather than JSON. **INFERRED**, and specifically
  not relied on: the connector does not sniff content.
- Because transport errors are surfaced in the Report Register, the provider
  probably retries or at least records failures. Whether it retries, how often,
  and with what backoff is **NOT YET VERIFIED**.

## 4. Not yet verified

Each item is a hole in the contract. Code must raise or decline rather than
guess in every one of these areas.

### 4.1 Authentication

**IMPLEMENTED 2026-08-14.** `BasicAuthenticator` in
`backend/integrations/authentication.py` implements **HTTP Basic
authentication compatible with the verified Seed Live Test Transport behavior
and RFC 7617 framing, with SmartVend policy requiring UTF-8 credentials and a
non-empty username and password.** The credential is resolved per connection
from `credential_ref` through the `CredentialProvider` contract in
`backend/integrations/credentials.py`.

This is **not** a claim of standards equivalence. SmartVend is deliberately
stricter than the RFC on two points: RFC 7617 leaves the credential charset
undefined, and it permits an empty password. Both are refused here.

- **Provider evidence:** HTTP Basic, verified from a Seed Live **Test
  Transport**.
- **Limit:** authentication behavior of a real **generated report delivery**
  remains **NOT VERIFIED**. No real delivery has ever been captured.
- **Route status:** still **unregistered** in `main.py`.

The implementation fails closed on every path: missing header, unsupported
scheme, malformed base64, undecodable bytes, a decoded credential with no
colon, an empty supplied username or password, a connection with no
`credential_ref`, an unresolvable reference, an unreachable secret store, and a
wrong username or password. Username and password are both compared with
`hmac.compare_digest`, and both comparisons always run so the response time does
not reveal whether the username alone was correct.

A connection with **no credential configured fails exactly like a wrong
password**, because distinguishing them would tell an unauthenticated caller
whether a credential reference exists.

#### Internal failure classes are distinct

Two conditions that look the same from outside are kept separate inside:

| Class | Covers | Meaning |
| --- | --- | --- |
| `AuthenticationFailed` | missing or malformed header, unsupported scheme, wrong username or password, connection with no usable credential configuration | The **caller** is at fault, or the connection is misconfigured. Retrying unchanged will not help |
| `AuthenticationBackendUnavailable` | secret store unreachable, timeout, any backing service failure | **Our** infrastructure could not complete the check. The caller may be perfectly legitimate |

`AuthenticationBackendUnavailable` is deliberately **not** a subclass of
`AuthenticationFailed`, and a `CredentialProviderUnavailable` is never converted
into one. A test asserts the two are unrelated in the type hierarchy and that
`except AuthenticationFailed` lets an outage through.

The reason is operational, not aesthetic: collapsing them would make an outage
indistinguishable from an attack in logs, metrics, and alerting, and would leave
any future retry policy with nothing to branch on. Backend failures log at
`error` with their own reason string; caller failures log at `warning`.

#### Public response for a backend outage is PROVISIONAL

The **public** HTTP status is a separate policy decision from the internal
class, and it is **not settled**.

Currently a backend outage returns the same `404` as every other
pre-authentication outcome. That is the conservative choice while the route is
unregistered, and it is what keeps the connection-identifier enumeration oracle
closed.

It is very likely the wrong long-term answer. A `4xx` tells Seed Live the
delivery failed permanently, when it should be retried once our store recovers.
A `5xx` would express that correctly but would reveal that the connection
identifier is real, because unknown identifiers are rejected earlier with `404`.

**NOT VERIFIED: what HTTP response Seed Live should receive when SmartVend's
authentication backend is temporarily unavailable.** Resolving it requires the
deliberate Seed Live failure and retry test: which statuses trigger a retry, how
many, and with what backoff. Until then, **404 is not the final answer** for a
secret-store failure. The mapping lives in one place,
`BACKEND_UNAVAILABLE_STATUS_PROVISIONAL` in `cantaloupe/routes.py`.

No secret store is wired. AWS Secrets Manager is the production direction and is
not part of this work, so the credential provider dependency fails closed and
tests supply an in-memory fake.

**RESOLVED 2026-08-12. See section 1A.** The mechanism is **HTTP Basic**,
configured through the transport's Username and Password fields, transmitted as
a standard `Authorization: Basic` header per RFC 7617. Blank fields send no
header at all. No signature, no token, no custom header.

Still open:

- Whether the password can be rotated without recreating the transport.
- Whether Seed Live enforces TLS certificate validation on our endpoint.

**Authentication is still not implemented in code.** The
`InboundAuthenticator` boundary and its deny-by-default implementation remain
as they are, and the route remains unregistered. Knowing the mechanism is not
the same as having implemented and reviewed it, and the requirements in
section 12 still gate registration.

### 4.2 HTTP wire format

- Method, exact path handling, and whether query parameters are appended.
- `Content-Type` actually sent, and whether it is honest about the body.
- Body encoding: raw CSV, multipart form upload, JSON envelope wrapping a
  payload, gzip.
- Character encoding and whether a BOM is present.
- Whether a filename is supplied, and in which header or form field.
- **How a real delivery identifies its report is still unknown.** A Test
  Transport appends the literal segment `testTransportFileName` and adds
  `reason=TEST`, and carries no report-type header. None of that establishes
  the real contract. Unresolved: whether a real report appends its actual
  filename, whether such a filename identifies the report type, and whether
  report type is conveyed anywhere else on a real delivery.
  **The HTTP adapter reads no report-type signal**, and
  `InboundReportRequest.report_type_hint` stays unset until a real delivery is
  observed.
- Maximum body size Seed Live will send. Our 25 MiB limit is a conservative
  guard, not a number derived from the provider.

### 4.5 Response contract

**Partly resolved 2026-08-12. `200` is accepted as success**, confirmed by Seed
Live's own "Transport Result Success: 200". The remaining questions stand:

- Does it accept `202`?
- Does it accept any `2xx`, or only specific codes?
- Does it require a particular response body, or a content type?
- How does it treat `4xx` against `5xx`?

**The endpoint returns `200` for every accepted delivery**, new or replay.
`202` is not used anywhere. Choosing 202 before this section is answered would
turn an assumption into a contract.

### 4.3 Delivery semantics

Partially answered for a **Test Transport** in section 1A.1: a 500 is treated
as failure, is reported immediately as `Invalid`, and produces no retry within
three minutes. Every question below remains open for a **real generated report
delivery**.

- Retry behavior on non-2xx: does it retry, how many times, with what interval?
- Which status codes does Seed Live treat as success? Does 202 satisfy it?
- Does it require a specific response body?
- Timeout before it considers a delivery failed.
- Ordering guarantees between scheduled reports.
- Whether the same report can be delivered twice, and under what conditions.
- Whether multiple active transports are supported simultaneously, which
  matters for running a test transport alongside a production one.

### 4.4 Report content

- The schema of every report, field by field.
- Report versioning: does a schema change announce itself?
- How devices are identified, and whether that identifier is stable.
- How selections and MDB codes are represented.
- How refunds, voids, and chargebacks are represented, and whether they arrive
  as separate records or as mutations.
- Timezone handling and whether timestamps carry an offset.
- Currency representation and decimal precision.
- Whether `productCode` or any provider code is unique, and in what scope.

**No parser is implemented for any report.** `CantaloupeConnector.parse` raises
`ReportParsingNotVerified`.

## 5. Proposed SmartVend endpoint

```
POST /integrations/cantaloupe/{connection_id}/reports
```

Provider-specific by design. Seed Live never sees the canonical SmartVend
model, and the canonical model is never shaped by a provider's wire format.

Current behavior, implemented and tested. Status codes are provisional and are
revisited once section 4.5 is answered.

| Condition | Response |
| --- | --- |
| Delivery preserved | `200 OK`, `{"status": "accepted", "artifact_id": ..., "replay": false}` |
| Byte-identical replay on the same connection | `200 OK`, same shape, `"replay": true`, original artifact id |
| Connection not accepting traffic, authenticated | `409 Conflict` |
| Empty body, authenticated | `400 Bad Request` |
| **Any pre-authentication rejection** | `404 Not Found`, `"Request could not be accepted."` |
| Authenticator or storage not configured | `503 Service Unavailable`, nothing stored |

Success is `200` in both cases, and the response body carries only what the
caller needs: an acceptance flag, an artifact identifier for support
correlation, and whether it was a replay. No idempotency key, no report
classification, no internal state.

**All pre-authentication rejections are indistinguishable.** Unknown
connection, connection belonging to another provider, oversized body, and
failed authentication all return the identical `404`. See section 5.1.

**The router is not registered in `main.py`.** It cannot receive traffic. This
is deliberate and is enforced by a test.

### 5.1 Connection identifier enumeration

`connection_id` appears in the URL, and connection resolution must happen
before authentication because credential configuration will be per-connection.
That creates a risk: if responses differ by whether a connection exists, an
unauthenticated caller can enumerate valid identifiers.

Resolved by normalizing every pre-authentication outcome to one response:

- unknown connection identifier
- connection belonging to a different provider
- body over the size limit
- failed authentication

all produce a byte-identical `404 Not Found` with `"Request could not be
accepted."` A test asserts the four responses are identical.

Consequences that were accepted deliberately:

- `413` is never returned. Exposing it would make the size limit an oracle.
- Connection state is checked **after** authentication, so a disabled
  connection returns `409` only to a caller who authenticated. To anyone else
  it is indistinguishable from an unknown identifier.
- `503` for an unconfigured authenticator or unconfigured storage is a
  server-wide condition, identical for every identifier, so it reveals nothing
  about any particular connection.
- Nothing in the response reveals tenant identity, the authentication scheme,
  or whether a credential reference exists.

Operational diagnostics are preserved internally: every rejection logs the real
reason and the connection identifier at `warning` level. Tenant identity is not
logged on a pre-authentication rejection, because the caller has not been shown
to have any relationship to a tenant.

Residual, accepted for now and to revisit before registration: an unknown
connection is rejected before the body is read, so a very large upload
completes faster against an unknown identifier than a real one. That is a
timing signal over a multi-megabyte upload, which is noisy and low value, and
removing it would mean buffering up to 25 MiB for callers we cannot attribute.

## 6. Customer connection model

One `CantaloupeConnector` implementation serves every customer. Each customer
relationship is one `IntegrationConnection` record carrying tenant, status,
credential reference, and provider-specific configuration.

```
CantaloupeConnector
    + connection A  (tenant A, credential ref A)
    + connection B  (tenant B, credential ref B)
    + connection C  (tenant C, credential ref C)
```

Hundreds of customers means hundreds of connection records, never hundreds of
connector classes. Tenant identity is resolved from the connection, never from
payload content.

## 7. Raw evidence flow

```
Seed Live
  -> POST /integrations/cantaloupe/{connection_id}/reports
  -> resolve connection            (tenant established here)
  -> authenticate                  (NOT YET IMPLEMENTED, denies by default)
  -> read body under a size limit
  -> SHA-256 of the exact bytes
  -> derive idempotency key
  -> identify report type          (declared hint only, never sniffed)
  -> persist raw artifact          (payload before metadata)
  -> acknowledge
  -> [later, out of this path] parse, map, transform, canonical model
```

Nothing is persisted before authentication succeeds, so an unauthenticated
caller cannot fill the artifact store. Parsing is out of the request path, so a
parser failure can never lose a delivery.

## 8. Mapping requirements

All **NOT YET VERIFIED**, pending report schemas.

- Telemetry device to SmartVend machine, as a temporal binding, since a device
  can move between machines. Historical events must resolve against the binding
  in force at event time.
- Provider selection code to SmartVend machine slot and product, scoped to a
  machine and a planogram period.
- Provider transaction identifier to canonical payment transaction and sale.
- Refund and adjustment linkage to the original transaction.

Every mapping resolves through the external identity crosswalk. No provider
identifier becomes a SmartVend primary key.

## 9. Expected transaction path

Once schemas are verified: validate against the declared schema, deduplicate by
provider record key, resolve device and selection through the crosswalk,
transform to canonical, write. A transaction whose device or selection cannot be
mapped is quarantined with a specific reason, never force-mapped and never
silently dropped.

No LLM sits anywhere in this path.

## 10. Questions the live test must answer

Every item below is currently unknown. Each must be recorded with evidence
before the corresponding code is written.

### HTTP request

- exact method
- path handling, including whether anything is appended
- query parameters, if any
- `Content-Type` actually sent
- `Content-Disposition`, if present
- filename, and where it is carried
- character encoding, and whether a BOM is present
- compression or transfer encoding
- the complete header set
- the exact raw body bytes

### Authentication

- mechanism: static header, basic auth, HMAC signature, mutual TLS, query
  token, or none
- where the secret is placed
- what is signed, with which algorithm, and where the signature is carried
- how a credential is configured per transport, and whether it can be rotated
  without breaking delivery

### Report identification

- how the report type is conveyed with a delivery, if it is conveyed at all
- if it is not conveyed, what else distinguishes one report from another

### Response contract

- whether `200` is accepted as success
- whether `202` is accepted
- whether any `2xx` is accepted, or only specific codes
- whether a response body or content type is expected

### Retry

- which status codes trigger a retry
- how many retries
- intervals and whether backoff is applied
- the timeout before a delivery is considered failed
- duplicate delivery behavior, and under what conditions a report is resent

## 10A. Account activity: RESOLVED

**VERIFIED 2026-08-13.** The account contains real transaction history.

Evidence path: **Build a Report -> Simple Report**. This is a distinct
navigation route from Reports -> Report Register, and it is the one that
produced usable evidence.

| Finding | Status |
| --- | --- |
| The account contains real activity | VERIFIED |
| Historical activity is visible in **September 2025** | VERIFIED |
| **2025-09-26** is active, with non-zero transaction amounts | VERIFIED |
| The report spans **11 pages**, so this is not an empty or non-production account | VERIFIED |
| Simple Report is aggregated **by day and payment type**, and is **not** sufficient for transaction-level migration or schema discovery | VERIFIED |

### Why the earlier exports were empty

This resolves the earlier puzzle rather than contradicting it. Both empty
exports sampled **2026** dates:

| Export | Period sampled | Result |
| --- | --- | --- |
| Activity - All | 2026-08-01 to 2026-08-12 | header row only, zero data rows |
| Pending Payment Summary | run 2026-08-07 | 7 sections, 2 data rows, every monetary column blank |

Activity exists in **2025**. The exports were not faulty and the transport was
not at fault: **the date ranges were wrong for this account**. The account
appears to be dormant in the recent period we sampled.

Operational consequence: **every future discovery export must target a period
with confirmed activity**, starting with 2025-09-26. Sampling recent dates on
this account will keep returning empty files and will keep looking like a
tooling failure when it is not.

### Sent Reports history does not cover the active period

**VERIFIED 2026-08-13.** This path:

```
Reports -> Report Register
  -> Transactions Included in EFT (<operator>)
  -> Filter By: User Report
  -> 09/01/2025 through 10/15/2025
```

The registered report is named after the vending operator. The name is omitted
here because this repository is public; it is a customer identifier and adds
nothing to the finding, which is about the path and the result.

returned **"No data found"**.

What this proves: the **Sent Reports history** for that registered report holds
no retrievable file for the confirmed-active September 2025 period, so it is
not a source of transaction-level evidence for that window.

What this does **not** prove: that the underlying EFT data did not exist. Only
the Sent Reports result is established. A registered report's sent history
reflects what was generated and retained, which is a different thing from what
transactions occurred.

Consequence: retrieving an already-sent historical file is not a viable route
to the transaction-level schema for September 2025. Evidence will have to come
from generating a report over that period, or from another mechanism.

### Next

Obtain transaction-level evidence for a confirmed-active window, ideally the
single day 2025-09-26. Given the Sent Reports result above, this most likely
means **generating** a Single Transaction Data Export over that period rather
than retrieving an existing one. Keep the window narrow: 11 pages of aggregated
activity implies substantial underlying volume, and this is real customer data.

## 11. Test transport procedure

**REQUIRES LIVE TEST.** This is the next action for this workstream and
everything downstream is blocked on it.

Preconditions: Seed Live account access with Report Register permissions, and a
publicly reachable HTTPS endpoint we control that captures and preserves raw
requests.

1. Stand up a capture endpoint that records the complete request: method, path,
   query string, every header, exact body bytes, and byte count. Store raw.
   Treat captured data as customer data.
2. In Seed Live, go to Reports -> Report Register -> Add Transport and configure
   an HTTP POST transport pointing at the capture endpoint.
3. Record every configuration field the transport offers, especially anything
   resembling a credential, secret, header, or signing option. This answers 4.1.
4. Trigger a delivery for **Single Transaction Data Export** first: it is the
   highest-value report and CSV is the likely format.
5. Capture and record everything under "HTTP request" in section 10.
6. Repeat for Transaction Line Item Data Export, DEX File, a refund report, and
   a device report.
7. Deliberately return `500` once and observe whether Seed Live retries, how
   many times, and with what interval. This answers the retry questions.
8. Return `200` and confirm the provider treats it as success. Then, on a
   separate delivery, return `202` and record whether that is also accepted.
   This decides whether our provisional `200` stays.
9. Attempt to configure a second simultaneous transport and record whether the
   product permits it.
10. Redact anything sensitive, then record the findings in this document,
    promoting each item from NOT YET VERIFIED to VERIFIED with the evidence.

Only after step 10 may authentication, parsers, and mappings be implemented.

## 12. Requirements before route registration

The router must not be registered in `main.py` until all of the following hold.

1. A verified inbound authenticator exists, implemented from evidence, not
   assumption.
2. The response-enumeration normalization in section 5.1 is reviewed against
   the real provider behavior, including whether a uniform `404` interferes
   with Seed Live's retry logic.
3. Status codes are confirmed against section 4.5, so success and failure codes
   match what the provider actually accepts.
4. Artifact and connection persistence exists, so a delivery is durably
   preserved rather than accepted into an interface with no implementation.
5. The size limit is set from observed report sizes rather than a guess.

## 13. Current implementation status

| Component | Status |
| --- | --- |
| Provider identity | Implemented |
| Connection record and resolver interface | Interface implemented, no persistence |
| Inbound request abstraction | Implemented |
| Raw artifact contract and store interface | Interface implemented, no persistence |
| Content hashing | Implemented, byte-exact, tested |
| Idempotency key derivation | Implemented, tested |
| Connector boundary | Implemented |
| Cantaloupe connector | Identification only, parsing refuses |
| Inbound route | Implemented, **not registered**. Returns 200 for accepted and for replay; all pre-authentication rejections normalized |
| Report identification from a delivery | **Not implemented.** No verified source exists, so the adapter supplies no hint |
| Authentication | **HTTP Basic implemented and tested offline.** Real generated-report authentication remains NOT VERIFIED |
| Credential resolution | Contract only. No secret store wired; AWS Secrets Manager deferred |
| Parsers | Not implemented, by design |
| Device and selection mapping | Not implemented, by design |
| Queueing, S3, SQS, Bedrock | Not implemented, out of milestone scope |
| Persistence schema | Not created. Requires coordination with the application consolidation workstream |
