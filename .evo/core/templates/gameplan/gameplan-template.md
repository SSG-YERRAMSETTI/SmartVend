# Gameplan: <name>

Status: PLAN. This document describes intended work, not current state.

Owner: <human>
Created: YYYY-MM-DD
Branch: <feat|fix|chore|refactor|docs>/<scope>

## Objective

What will be true when this is done, stated as an outcome rather than a task
list.

## Out of scope

What this work will not do. Scope expansion during execution is a review
finding, so name the boundary now.

## Current state

What exists today, verified. Reference the code, the schema, or the command that
was run. Do not assume.

## Milestones

Each milestone is a candidate significant checkpoint: it works end to end and
can be validated. Not a checklist of edits.

| # | Milestone | Acceptance criteria | Validation |
| --- | --- | --- | --- |
| 1 | | | |
| 2 | | | |

## Risks

What could go wrong, how it would be detected, and what the fallback is.
Include data-loss risk, irreversible steps, and external dependencies.

## Validation

Which `evo validate` entries must pass for this work. Any new validation that
must be added to `.evo/project/config.toml`.

## Decisions required

Anything that needs a human decision before or during execution. Anything that
will need an ADR.

## Rollback

How to undo this if it goes wrong after merge.
