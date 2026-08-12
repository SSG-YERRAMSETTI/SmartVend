# Runbook: <procedure name>

Owner: <team or role>
Last verified: YYYY-MM-DD by <who>
Environment: development | staging | production

A runbook is executed under pressure. Write it so that someone who has not done
this before can follow it exactly.

## When to use this

The trigger. The symptom, alert, or request that leads here. Also state when
this runbook does not apply.

## Preconditions

Access, permissions, tools, and approvals required before starting. If human
authorization is required, say so here and name who can give it.

## Safety

Irreversible steps in this procedure. What must be verified before each.
What data can be lost and how it is protected first.

## Procedure

Numbered, exact steps. Real commands, with placeholders clearly marked.
After each step that changes state, state how to confirm it worked.

1.
2.
3.

## Verification

How to confirm the whole procedure succeeded, beyond the absence of errors.

## Rollback

How to undo, step by step. If a step cannot be undone, say so explicitly rather
than leaving it unstated.

## Escalation

Who to contact, when to stop, and what information to bring.

## Notes

Known failure modes and what they look like.
