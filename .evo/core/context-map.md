# Context map

Static routing from the kind of work you are doing to the EVO documents you
should load. Load what the task needs. Do not load everything.

This is deliberately a static map. EVO v0.1 uses no embeddings, no semantic
retrieval, no vector search.

## Always

- `EVO.md`
- `constitution/engineering-principles.md`
- `constitution/ai-behavior.md`
- `constitution/security.md`
- `.evo/project/context.md` and `.evo/project/state.md` when present

Load `constitution/git-workflow.md` and `constitution/checkpoints.md` before
proposing a commit. Load `constitution/documentation.md` before changing
authoritative documentation. Load `constitution/context-engineering.md` when
deciding what to read, what to record, or whether compiled knowledge is stale.

## By work type

| Work | Load |
| --- | --- |
| Python | `standards/python.md`, `standards/testing.md`, `constitution/security.md` |
| TypeScript | `standards/typescript.md`, `standards/testing.md`, `constitution/security.md` |
| Frontend / UI | `standards/frontend.md`, `standards/ui-ux.md`, `standards/typescript.md`, `standards/testing.md`, `architecture/frontend-patterns.md` |
| HTTP API | `standards/api-design.md`, `constitution/security.md`, `standards/testing.md`, `standards/observability.md` |
| Database / schema / migration | `standards/database.md`, `constitution/security.md`, `standards/testing.md` |
| AWS / infrastructure | `standards/aws.md`, `constitution/security.md`, `standards/observability.md`, `architecture/aws-reference.md` |
| Backend service structure | `architecture/backend-patterns.md`, `standards/api-design.md`, `standards/testing.md` |
| Multi-tenant behavior | `architecture/multi-tenant-systems.md`, `standards/database.md`, `constitution/security.md` |
| Agentic / LLM features | `standards/agentic-systems.md`, `architecture/agent-systems.md`, `constitution/ai-behavior.md`, `constitution/security.md`, `standards/testing.md`, `standards/observability.md` |
| External integration | `agents/integration-reviewer/contract.json`, `standards/api-design.md`, `standards/observability.md`, `constitution/security.md` |
| Release | `runbooks/release-validation.md`, `agents/release-validator/contract.json` |
| Onboarding a project into EVO | `runbooks/project-onboarding.md` |
| Changing architecture | `runbooks/architecture-change.md`, `templates/adr/adr-template.md` |

## Reviewer roles

Each role is defined by `agents/<role>/contract.json`. Adopt a contract when the
change touches that domain.
`checkpoint-reviewer` is mandatory before proposing a significant commit. The
others are applied when relevant:

| Change touches | Reviewer |
| --- | --- |
| any significant commit | `checkpoint-reviewer` |
| any code | `code-reviewer` |
| auth, secrets, tenancy, input handling, dependencies, permissions | `security-reviewer` |
| HTTP surface, contracts, clients | `api-reviewer` |
| schema, migration, query, data ownership | `database-reviewer` |
| user-visible interface | `ui-ux-reviewer` |
| module boundaries, data flow, service topology, tech selection | `architecture-reviewer` |
| third-party or cross-system integration | `integration-reviewer` |
| a release or deployment | `release-validator` |

## Knowledge and decisions

- `knowledge/approved-technologies.md` before introducing a dependency, a
  service, or a tool
- `.evo/project/context.md` for this project's verified architecture, data,
  integrations, and constraints
- `.evo/project/decisions/` for this project's accepted ADRs

EVO's own ADRs and organization-level context live in `knowledge/` in the EVO
source repository. They are not installed into projects.

## Paths

Inside an installed project every path above is relative to `.evo/core/`, except
`.evo/project/**`, which is written as shown. In the EVO source repository the
same paths are relative to the repository root.
