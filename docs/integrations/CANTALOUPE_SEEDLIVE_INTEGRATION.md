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

- How does Seed Live authenticate to our endpoint? Static header, basic auth,
  HMAC signature, mutual TLS, query token, or nothing at all?
- Can a per-connection secret be configured in the transport?
- Is there a signature over the body, and if so what is signed, with what
  algorithm, and where is it carried?
- Can we rotate a credential without breaking delivery?

**Nothing about authentication is implemented.** The code defines the
`InboundAuthenticator` boundary and a deny-by-default implementation that
rejects every request. The route is not registered in the application. Inventing
a header contract and calling it Cantaloupe behavior would produce an endpoint
that looks authenticated and is not.

### 4.2 HTTP wire format

- Method, exact path handling, and whether query parameters are appended.
- `Content-Type` actually sent, and whether it is honest about the body.
- Body encoding: raw CSV, multipart form upload, JSON envelope wrapping a
  payload, gzip.
- Character encoding and whether a BOM is present.
- Whether a filename is supplied, and in which header or form field.
- Whether the report type is conveyed anywhere in the request, and how.
  **Nothing in the HTTP adapter reads a report-type signal.** The
  provider-neutral `InboundReportRequest.report_type_hint` exists for an
  adapter that has a verified source; the Cantaloupe adapter leaves it unset.
  Candidates once a real delivery is captured: a header, the filename, a query
  parameter, content disposition, body structure, or the transport
  configuration itself. We do not choose one now.
- Maximum body size Seed Live will send. Our 25 MiB limit is a conservative
  guard, not a number derived from the provider.

### 4.5 Response contract

- Does Seed Live accept `200` as success?
- Does it accept `202`?
- Does it accept any `2xx`, or only specific codes?
- Does it require a particular response body, or a content type?
- How does it treat `4xx` against `5xx`?

**The endpoint returns `200` for every accepted delivery**, new or replay.
`202` is not used anywhere. Choosing 202 before this section is answered would
turn an assumption into a contract.

### 4.3 Delivery semantics

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
| Authentication | **Boundary only, denies by default** |
| Parsers | Not implemented, by design |
| Device and selection mapping | Not implemented, by design |
| Queueing, S3, SQS, Bedrock | Not implemented, out of milestone scope |
| Persistence schema | Not created. Requires coordination with the application consolidation workstream |
