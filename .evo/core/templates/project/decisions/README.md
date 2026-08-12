# Project decisions

Architectural decision records for this project. Project-owned; EVO never
overwrites this directory.

One file per accepted material decision, named `ADR-NNNN-short-title.md`,
numbered sequentially from `ADR-0001`.

Use `.evo/core/templates/adr/adr-template.md`, which carries the structure:
Status, Date, Supersedes, Context, Decision, Consequences.

## When to write one

- a technology is introduced or removed
- a module or service boundary changes
- a source of truth moves
- a data model changes materially
- an integration pattern is chosen
- a security or tenancy model changes
- a deliberate deviation from an Evolium standard is accepted

## When not to write one

Trivial coding choices, naming, formatting, or anything the code itself makes
obvious.

## Lifecycle

Records are append-only. A decision that is replaced is marked `Superseded by
ADR-NNNN` rather than edited or deleted. The history of why matters as much as
the current answer.
