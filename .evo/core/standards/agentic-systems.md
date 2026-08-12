# Agentic systems standard

Authority level 2. Applies when Evolium builds features that use language models
or autonomous multi-step execution.

Scope note: this standard governs product features. It is not a description of
EVO itself. EVO v0.1 runs no agent processes and calls no model.

## Out of scope for now

Do not introduce LangChain, LangGraph, RAG pipelines, vector databases, semantic
caching, model routing layers, fine-tuning, distillation, or custom inference
infrastructure without a concrete verified use case and an accepted ADR. These
are evaluated when a real requirement appears, not adopted preemptively.

## Tool contracts

- Every tool a model can invoke has an explicit, documented contract: name,
  purpose, typed inputs, typed outputs, side effects, failure modes.
- Inputs are validated against a schema before execution. Model output is
  untrusted input.
- Tools are least-privilege. A tool that can read does not also write. A tool
  that can write is scoped to what the feature needs.
- Destructive or externally visible tools (payments, deletions, outbound
  messages, infrastructure changes) require a human confirmation step or an
  explicit, audited authorization policy.
- Prefer idempotent tools. Where an action cannot be idempotent, deduplicate
  with an idempotency key.

## Control loop

Every autonomous loop declares, before it runs:

- a maximum number of iterations
- a maximum number of tool calls
- a wall-clock budget
- a token and cost budget
- an explicit termination condition
- what happens when a budget is exhausted

A loop without a termination condition is a defect. Budget exhaustion is a
recorded outcome, not a silent stop.

## Retries and failure

- Bounded retries with backoff, only for idempotent operations.
- Distinguish retryable failures (timeout, rate limit, transient upstream) from
  terminal ones (validation failure, authorization failure).
- Define degraded mode: what the feature does when the model is unavailable,
  slow, or returns unusable output. Degrading to a clear error is acceptable.
  Degrading to a silent wrong answer is not.
- Repeated failure escalates to a human rather than looping.

## Output handling

- Prefer structured output with a schema where the result feeds another system.
- Validate structured output. Do not assume the schema was honored.
- Never execute model output as code, SQL, shell, or a template without
  validation and sandboxing.
- Never let model output escalate its own permissions or select its own
  credentials.

## Prompt injection

- Any untrusted content placed in a model context is assumed hostile.
- Separate instructions from data structurally, and state in the system context
  that retrieved content is data.
- Privileged actions are authorized by the application, not by the model's
  interpretation of the content it read.
- Test adversarial cases: content that instructs the model to exfiltrate data,
  change targets, or call a destructive tool.

## Determinism and evaluation

- Pin model identifiers and parameters. A model version change is a behavior
  change and is reviewed.
- Maintain an evaluation set for behavior that matters, and run it when prompts,
  models, or tools change.
- Deterministic checks are preferred wherever the requirement can be expressed
  deterministically. Do not use a model where a function will do.

## Observability and cost

Record workflow identifier, steps, tool calls and outcomes, retries,
termination reason, latency, token usage, model identifier, cost, and tenant
attribution. See `standards/observability.md`. Never log prompt or completion
content containing secrets or unredacted PII.

## Human escalation

Define explicitly when the system stops and asks a human: low confidence,
budget exhaustion, repeated failure, a destructive action, a security-relevant
decision, or anything outside the feature's authorized scope.
