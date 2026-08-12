# Significant checkpoints

Authority level 1. This is the policy that governs when Evolium code is
committed.

## Principle

Commits mark validated, coherent progress. The engineering model implements
approved work freely, but it does not decide on its own to commit. It decides
when a checkpoint has been reached, validates it, reviews it, and then asks a
human.

## The model decides what is significant

Significant, typically:

- a complete feature works
- a meaningful sub-feature works end to end
- a connector or integration is implemented and verified
- a database migration plus its dependent code is complete
- a meaningful architectural refactor is complete
- a bug is fixed and a regression test proves it
- an accepted gameplan milestone is complete

Not significant, typically:

- formatting or renaming
- adding one helper
- partial implementation
- debugging changes
- unfinished refactoring
- tests still failing
- code that has not been validated

If unsure, keep working. A premature checkpoint wastes a human review cycle.

## Procedure

1. **Stop expanding scope.** No new work enters the checkpoint after this point.
2. **Run `evo checkpoint`.** It executes the configured deterministic
   validations, collects Git metadata and changed files, classifies
   architecture-, security- and documentation-sensitive paths, and writes a
   report with `review_state: PENDING_MODEL_REVIEW` into `.evo/runtime/`.
3. **Adopt the checkpoint reviewer role.** Read
   `.evo/core/agents/checkpoint-reviewer/contract.json` and perform that review
   against the actual diff.

   EVO v0.1 does not call an external model. The model currently operating the
   repository performs the reviewer role by reading the contract. This is a
   role change within the same session, not a separate process.
4. **Apply additional reviewer contracts** when the change touches their domain:
   security, API, database, UI/UX, architecture, integration, release.
5. **Fix material findings.** Critical and high findings block the checkpoint
   until fixed or explicitly accepted by the human.
6. **Rerun the affected validations.** A fix invalidates the prior run.
7. **Update authoritative documentation** only if materially required by
   `constitution/documentation.md`.
8. **Present the human checkpoint request** and stop.

## Human checkpoint request format

```
Significant checkpoint reached.

Milestone:
<completed milestone>

Validation:
<required checks and result>
<important warnings>

Review:
<PASS / PASS_WITH_WARNINGS>

Changed:
<concise scope>

Proposed commit:
<conventional commit message>

Commit and push?
```

Then wait. Do not commit while waiting. Do not continue implementing new work
into the same checkpoint while waiting.

## After approval

The model may commit and push the current short-lived branch.

The model may not, without a further explicit human authorization for that
specific action: push to `main`, merge a pull request, force push, rewrite
shared history, bypass a failing required validation, or proceed with an
unresolved critical or high finding.

## Review outcomes

- `PASS` no critical or high findings; medium and low findings recorded.
- `PASS_WITH_WARNINGS` no critical or high findings; unresolved warnings exist
  and are stated in the checkpoint request.
- `BLOCK` at least one critical or high finding. Do not present a commit
  proposal. Fix, or escalate for explicit human acceptance.

## Honesty requirements

- A validation that did not run is reported as not run, never as passed.
- If validation is not configured for the project, say so plainly rather than
  implying the change is verified.
- Do not weaken, skip, or disable a validation to reach `PASS`.
- Do not present a commit proposal built on unverified assumptions.
