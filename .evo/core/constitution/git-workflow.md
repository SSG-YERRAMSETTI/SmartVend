# Git and delivery

Authority level 1.

## Branches

Default integration branch: `main`.

Short-lived working branches:

```
feat/<scope>
fix/<scope>
chore/<scope>
refactor/<scope>
docs/<scope>
```

Lifecycle:

```
main -> short-lived branch -> meaningful checkpoint commits -> pull request -> main
```

Permanent parallel development branches (`develop`, `staging` as a long-lived
code branch) are not the Evolium default. A project that needs one records the
reason as a project ADR.

A branch is short-lived: it exists to carry one coherent unit of work to `main`.
If a branch is outliving its purpose, split the work.

## Repository bootstrap exception

A repository with no commits has no `main` to branch from, so the standard
lifecycle cannot exist yet. One narrow exception applies:

- When a repository has **zero commits**, the validated first commit may
  establish `main`.
- The work may be prepared on the unborn branch or on an orphan branch such as
  `chore/<scope>-bootstrap`, and that branch may become `main`.
- The first commit still goes through the full checkpoint procedure and still
  requires explicit human approval before it is created or pushed. Nothing about
  the gate is relaxed.
- Do not create a placeholder or empty commit purely to establish `main`. The
  first commit is real, validated work.

The exception ends the moment the repository has a commit. From then on all work
uses short-lived branches and pull requests back into `main`.

This does not weaken the prohibition below. A model still may not push to `main`
on an established repository, and even the bootstrap commit and its push require
the human to authorize that specific action.

## Commits

Use Conventional Commit style where practical:

```
<type>(<scope>): <imperative summary>
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `build`,
`ci`.

Examples:

```
feat(seedlive): add report ingestion adapter
fix(api): prevent duplicate transaction import
refactor(db): consolidate inventory ownership
docs(architecture): record canonical data decision
chore(evo): bootstrap engineering system
```

A commit represents a significant checkpoint: something coherent that works and
was validated. Commits are not save points for partial work. See
`constitution/checkpoints.md`.

The commit body explains why, when why is not obvious from the summary. Git
already records what changed; do not restate the diff.

## Pull requests

A pull request describes the change, the validation that was run and its
results, the risk, and the rollback path. It links the ADR when the change was
architectural.

Required deterministic validation must pass before merge. A failing required
check is not overridden without explicit human authorization recorded in the
pull request.

## Prohibited without explicit human authorization

- committing without the checkpoint procedure
- pushing directly to `main`, except the one-time bootstrap commit described
  above, which still requires explicit human approval
- merging a pull request
- force pushing any shared branch
- rewriting shared history
- deleting a branch that others may be using
- committing with a required validation failing
- committing secrets or secret-bearing environment files

## Secrets

If a secret reaches a commit: stop, tell the human immediately, rotate the
secret, then remediate history. Removing the file in a later commit does not
remove it from history and does not undo the exposure.

## Repository hygiene

- Runtime and build artifacts are gitignored. EVO installs `.evo/.gitignore`
  covering `.evo/runtime/`.
- Generated files that are committed are labeled as generated and their
  generator is recorded.
- Large binaries and data extracts do not belong in the repository.
