# Agent contracts

An EVO agent is a reusable engineering review role, not a process.

EVO v0.1 runs no agent processes and calls no external model. The model
currently operating the repository adopts a role by reading its contract and
applying it to the actual change. This is a role change within the same session.

## Format

One directory per role containing `contract.json`, validated against
`schemas/agent-contract.schema.json`.

Contracts are JSON rather than prose so that they are machine-validatable and so
that a single authoritative copy exists. There is no parallel Markdown copy to
drift.

Fields:

| Field | Meaning |
| --- | --- |
| `schema_version` | contract schema version |
| `name` | role identifier, matches the directory name |
| `purpose` | one sentence stating what this role is responsible for |
| `when_to_invoke` | conditions under which this role applies |
| `required_inputs` | what must be available before the review starts |
| `allowed_actions` | what the role may do |
| `required_checks` | what the role must evaluate |
| `output_contract` | status values, severities, and required output fields |
| `failure_conditions` | what makes the review itself invalid |
| `stop_conditions` | when to stop reviewing and report |
| `escalation_conditions` | when a human decision is required |

## Roles

| Role | Applies when |
| --- | --- |
| `checkpoint-reviewer` | mandatory before proposing any significant commit |
| `code-reviewer` | any code change |
| `security-reviewer` | auth, secrets, tenancy, input handling, dependencies, permissions, model tool surfaces |
| `api-reviewer` | HTTP surface, contracts, clients |
| `database-reviewer` | schema, migration, query, data ownership |
| `ui-ux-reviewer` | user-visible interface |
| `architecture-reviewer` | module boundaries, data flow, service topology, technology selection |
| `integration-reviewer` | third-party or cross-system integration |
| `release-validator` | a release or deployment |

Responsibilities are intentionally non-overlapping. `checkpoint-reviewer`
orchestrates and decides the gate; the domain roles supply findings.
