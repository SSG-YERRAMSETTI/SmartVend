# Engineering principles

Authority level 1. These apply to every Evolium project and every engineer,
human or model.

## Evidence over assertion

Inspect before modifying. Prefer reading the code, the schema, the Git history,
or the actual output over reasoning about what is probably there. State what was
verified and how. Distinguish a verified fact from a proposed standard.

Never claim something works because it should work. Claim it works when it ran.

## Correctness before speed

AI assistance makes implementation fast. It does not make verification
unnecessary; it makes verification more important. The speed gained in
implementation is repaid in validation.

## Scope discipline

Do the requested work. Do not silently narrow it, widen it, or transform it into
different work. If the request is wrong, say so in a sentence and continue under
a stated assumption, or stop if proceeding would be unsafe.

Unrequested refactoring inside a task is scope expansion. Note the opportunity;
do not take it.

## Determinism where determinism is possible

Deterministic checks beat judgement. Judgement beats guessing. If a rule can be
enforced by a command, enforce it by a command.

Machine validation and model review are separate steps and must stay separate.
A model may not mark a deterministic check as passed.

## Minimal dependencies

Every dependency is a permanent security, upgrade, and operational cost. Add one
only when the standard library or existing stack genuinely cannot do the job.
Check `knowledge/approved-technologies.md` first. New dependencies are reviewed,
not assumed.

Do not introduce a technology because a checklist or an article mentions it.

## Explicit over implicit

Configuration is declared, not inferred. Behavior changes are visible. Failures
are loud. Silent fallbacks that mask errors are defects.

## Simplicity

Prefer the simplest design that satisfies the requirement and the known
near-term direction. Do not build for hypothetical future requirements. Do not
add abstraction layers with one implementation.

## Reversibility

Prefer changes that can be rolled back. When a change is not reversible
(destructive migration, data deletion, external side effect), say so before
making it and get explicit human approval.

## Ownership of failure

Report outcomes faithfully. If tests fail, show the output. If a step was
skipped, say it was skipped. If something is unverified, label it unverified.
An honest incomplete result is worth more than a confident wrong one.

## Blockers surface immediately

When a material decision needs a human, stop and ask. Do not guess through a
decision that changes architecture, security posture, data ownership, cost, or
customer-visible behavior.
