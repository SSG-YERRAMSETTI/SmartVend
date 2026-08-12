# Approved technologies

Status of a technology for Evolium engineering. Consult before adding a
dependency, a service, or a tool.

Last updated: 2026-08-10.

Scope note: this reflects decisions made or verified during the EVO v0.1
bootstrap. It is not a survey of what Evolium projects currently use; that has
not been audited. A technology absent from this file is UNDER REVIEW by default,
not forbidden and not approved.

## Categories

- **APPROVED** verified in use or explicitly decided. Use without a new decision.
- **PROVISIONAL** acceptable for a specific stated context; revisit before
  broadening.
- **UNDER REVIEW** no Evolium decision exists. Requires an explicit decision,
  and an ADR when material.

## APPROVED

| Technology | Scope | Basis |
| --- | --- | --- |
| Git | version control, all projects | in use; EVO repository |
| GitHub (`Evolium-IOS`) | hosting, pull requests | in use; verified remote |
| Python 3.11+ | EVO tooling | ADR-0001, EVO v0.1 implementation |
| Python standard library | EVO tooling | EVO v0.1 has zero runtime dependencies |
| TOML | project-owned configuration | ADR-0001; read with `tomllib` |
| JSON | machine-readable EVO artifacts (manifest, reports, contracts, schemas) | EVO v0.1 implementation |
| Markdown | standards and documentation | EVO v0.1 implementation |
| `unittest` | EVO's own test suite | zero test dependencies |

## PROVISIONAL

| Technology | Scope | Condition |
| --- | --- | --- |
| `setuptools` | EVO packaging backend | build-time only, no runtime dependency; revisit if packaging needs change |

## UNDER REVIEW

No Evolium-wide decision exists for these. They are listed because they were
named in scope discussions, not because they are candidates.

| Technology | Note |
| --- | --- |
| Application frameworks (web, API, ORM) | not audited; project-level choice until an Evolium decision exists |
| Frontend frameworks and build tooling | not audited |
| Test runners beyond `unittest` (for example pytest) | project-level choice; declared in project config |
| Linters, formatters, type checkers | project-level choice; declared in project config |
| Browser and end-to-end tooling (for example Playwright) | project-level choice; never required by EVO |
| AWS services | not audited; see `architecture/aws-reference.md` |
| Observability vendors | no Evolium decision |

## Explicitly deferred

Not adopted in EVO v0.1, and not to be introduced without a verified use case
and an accepted ADR:

LangChain, LangGraph, RAG pipelines, vector databases, semantic caching, model
routing layers, fine-tuning, model distillation, custom inference
infrastructure, embeddings-based retrieval inside EVO.

Rationale: EVO v0.1 requires none of them, each adds permanent operational and
security cost, and none has a verified Evolium requirement yet.

## Adding a technology

1. State the requirement and why the existing stack does not meet it.
2. Check maintenance status, license, transitive weight, and known
   vulnerabilities.
3. Record the decision as an ADR when it is material.
4. Update this file.
