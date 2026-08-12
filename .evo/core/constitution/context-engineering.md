# Context engineering

Authority level 1.

Goal: reduce repeated rediscovery without replacing evidence with potentially
stale summaries. Token efficiency is a design requirement, not an optimization.

## Three layers

### A. Raw evidence

Source code, Git history, configuration, database schemas, infrastructure
output, test results, API documentation, external system observations,
customer-provided technical information.

Raw evidence is authoritative and is never disposable. There is no rule that a
source file may be read only once. Read it again when the answer matters.

### B. Compiled knowledge

The current verified interpretation of important information: current
architecture, project state, current infrastructure, approved technologies,
active integrations, known constraints, accepted operating patterns.

Compiled knowledge is an optimization layer over evidence. It is a cache, and
like any cache it can be stale. It carries the date or commit at which it was
verified, and source references where practical.

Compiled knowledge lives in `.evo/project/context.md`, `.evo/project/state.md`,
and `knowledge/`. It is not a copy of every document in the project, and it is
not something every model must read in full on every session.

### C. Decisions

ADRs recording why an important engineering decision was made, what changed, and
what it replaced. Decisions are append-only history: superseded ADRs are marked
superseded, not deleted or rewritten.

## Rules

1. Read compiled knowledge first when it exists.
2. Inspect raw evidence when information is missing, changed, stale, disputed,
   high-risk, security-relevant, or when the task requires verification.
3. Update compiled knowledge when verified facts materially change. Do not
   update it for trivia.
4. Record material architecture decisions as ADRs.
5. Preserve source references where practical, so a later reader can re-verify
   without rediscovering.
6. Load only the standards the current task needs, using `context-map.md`.

## Staleness

Treat compiled knowledge as suspect when:

- it contradicts the code
- the referenced files no longer exist
- it describes an integration that has since changed
- it was verified long ago and the area has active commits
- the decision it depends on has been superseded

When compiled knowledge is wrong, correct it in the same session. Leaving a
known-wrong statement in compiled knowledge is a defect, because the next model
will trust it.

## Anti-patterns

- A single large knowledge base that every session must read in full.
- Deleting or ignoring raw evidence because a summary exists.
- Recording activity logs instead of verified state.
- Summarizing a plan as if it were current state.
- Copying entire project documentation into EVO.
