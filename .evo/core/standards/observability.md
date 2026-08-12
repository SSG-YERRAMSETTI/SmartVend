# Observability standard

Authority level 2.

Observability answers: is it working, for whom is it failing, and why. A system
that cannot answer those questions in production is incomplete.

EVO does not mandate a vendor. The project declares its stack.

## Correlation

- Every request, job, and workflow carries a correlation identifier from entry
  to every downstream call and every log line.
- Inbound correlation identifiers from trusted callers are propagated; from
  untrusted callers they are recorded but not trusted as unique.
- Asynchronous work carries the originating correlation identifier through the
  queue.

## Logging

- Structured logs. One event per line, machine-parseable.
- Levels used consistently: `error` needs human attention; `warn` is a degraded
  but handled condition; `info` is a significant state change; `debug` is
  developer detail and is off in production.
- Every log line carries correlation identifier, and tenant identifier where
  applicable.
- Redaction by default. Never log secrets, tokens, credentials, full request or
  response bodies, or unredacted PII. Logging an entire object is a defect
  unless the redaction is proven.
- Errors log the cause and the context needed to act, not just the message.

## Metrics

Minimum for a service: request rate, error rate, latency distribution
(including tail), saturation of the constrained resource. For queues: depth,
age of oldest message, failure and retry counts, dead-letter volume.

## Tracing

Where the project supports it, trace across service and external boundaries.
Spans record the external dependency, the operation, and the outcome.

## External dependency health

Every integration reports: call volume, error rate, latency, timeout rate,
retry rate, and rate-limit responses. An integration with no visibility is an
outage waiting to be discovered by a customer.

## Workflow and agent execution

For agentic or multi-step workflows, record: workflow identifier, step, tool
invocations with outcome, retries, termination reason, and elapsed time. A
workflow that ends must record why it ended, including budget exhaustion.

## Model cost and usage

Where LLM functionality exists, record token usage per request, model
identifier, cost attribution, and tenant attribution. Cost that cannot be
attributed cannot be controlled. Never log prompt or completion content that
contains PII or secrets.

## Alerting

Alert on user-visible symptoms and on conditions that require human action.
Alerts that nobody acts on are removed. Every alert names an owner and an action.

## Health checks

Liveness and readiness are distinct. Readiness reflects the dependencies the
instance actually needs. A health check that always returns healthy is worse
than none.
