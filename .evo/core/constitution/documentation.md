# Documentation

Authority level 1.

Favor authoritative documentation over documentation volume. One correct
current document beats ten partially stale ones.

## What documentation is for

Documentation carries what the code and Git history cannot: current
interpretation, intent, constraints, and decisions. It does not duplicate what
the repository already states.

Do not create:

- activity logs of commands executed
- per-change narrative summaries
- documentation for trivial implementation details
- a second copy of information that lives in code or configuration

Git records implementation history. Do not re-record it.

## Required categories

Project documentation distinguishes:

- **CURRENT STATE** what is true now, verified
- **DECISIONS** ADRs, why and what they replaced
- **KNOWN ISSUES** open defects, limitations, accepted risks
- **RUNBOOKS** how to perform an operational procedure
- **EVIDENCE / REFERENCES** where a claim can be verified

A plan is labeled as a plan. A proposal is labeled as a proposal. Never write a
plan in the voice of current state.

## When to update

Update authoritative documentation when:

- architecture materially changes
- an external integration materially changes
- operational behavior changes
- an important constraint changes
- an ADR is accepted
- project state materially changes

Do not update documentation for a change that does not alter any of the above.

## Project files

- `.evo/project/context.md` compiled knowledge: what this project is, its
  architecture, its integrations, its constraints, its approved technologies.
  Verified facts only, with source references where practical.
- `.evo/project/state.md` current state, in-flight work, known issues.
- `.evo/project/decisions/` ADRs, one per accepted material decision.

These are project-owned. `evo sync` never overwrites them.

## Writing standard

- Plain English. Short sentences.
- ASCII punctuation. No emojis, no decorative characters.
- No marketing language, no superlatives, no unverifiable claims.
- Label unverified content as unverified.
- State the date or the commit when the claim was verified, when staleness would
  be dangerous.
- Prefer a table or a list over a paragraph when the content is structured.

## Staleness

A document that is wrong is worse than a document that is missing, because it is
trusted. When you discover documentation that contradicts verified evidence,
fix the documentation as part of the current work or record it explicitly as a
known issue. Do not leave it.
