# Runbook: architecture change

Owner: Evolium engineering
Environment: any

Follow this when a change alters module or service boundaries, data flow, a
source of truth, the tenancy or security model, or introduces a technology.

## Preconditions

- The requirement is understood and stated as an outcome.
- Accepted project ADRs in `.evo/project/decisions/` have been read.
- `knowledge/approved-technologies.md` has been read if a technology is being
  introduced.

## Safety

An architecture change that is implemented before it is decided is difficult to
reverse, because code accumulates against it. Write the decision first.

## Procedure

1. Verify the current state from evidence, not from documentation. Read the
   code, the schema, and the configuration that the change will affect. Note
   where existing documentation is wrong; that is itself a finding.

2. State the problem and the constraints. If the problem cannot be stated
   without naming a solution, it is not understood yet.

3. Identify the options actually available, including doing nothing and the
   smallest change that meets the requirement. Prefer the simplest sufficient
   design.

4. Apply the `architecture-reviewer` contract to the proposed option: dependency
   direction, boundary integrity, coupling, duplication, source of truth, blast
   radius, operational cost.

5. Write the ADR using `templates/adr/adr-template.md`, into
   `.evo/project/decisions/ADR-NNNN-<title>.md`, with status `Proposed`. State
   the consequences honestly, including what it forecloses.

6. Obtain human acceptance. Set status to `Accepted`. If it replaces an earlier
   decision, mark the earlier record `Superseded by ADR-NNNN` rather than
   editing it.

7. Plan the migration path. For anything touching persisted data or a public
   contract, use expand then contract: introduce the new shape, migrate readers,
   migrate writers, then remove the old shape in a later change.

8. Implement in reviewable milestones, each a candidate significant checkpoint.

9. Update `.evo/project/context.md` to reflect the new current state once the
   change is live, with the verification date.

## Verification

- The accepted ADR exists and matches what was built.
- Superseded decisions are marked.
- `.evo/project/context.md` describes the new state, not the old one and not the
  plan.
- Validation passes, including tests covering the new boundary.

## Rollback

Named in the ADR's consequences. If the change is not reversible, that must be
stated in the ADR before implementation begins.

## Escalation

Stop and ask a human for: any material architectural decision, introduction of a
technology with no Evolium decision, a change to a source of truth, a change to
the tenancy or security model, or a conflict with an accepted ADR.
