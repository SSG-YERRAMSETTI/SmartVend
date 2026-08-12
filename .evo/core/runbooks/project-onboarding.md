# Runbook: onboard a project into EVO

Owner: Evolium engineering
Environment: development

Installs EVO into an existing Evolium Git repository and establishes its
project-owned context.

## Preconditions

- The target repository exists locally and is a Git repository.
- A local EVO checkout exists at the version you intend to pin.
- `python -m pip install -e .` has been run from the EVO checkout.
- You have decided which profiles apply.

## Safety

`evo install` never overwrites project-owned files. It does refuse to proceed
when a root entrypoint (`EVO.md`, `CLAUDE.md`, `AGENTS.md`) already exists with
different content. Resolve that deliberately with `--adopt` (preserves the
existing file under `.evo/project/adopted/`) or `--force` (discards it). Do not
use `--force` before reading the existing file.

## Procedure

1. Confirm the EVO source version you are pinning.

   ```
   git -C <evo-checkout> log -1 --oneline
   cat <evo-checkout>/VERSION
   ```

2. Confirm the environment is clean enough to see what install adds.

   ```
   git -C <project> status --short
   ```

3. Dry run. Nothing is written.

   ```
   evo install --project <project> --profiles base,python --dry-run
   ```

   Read the planned file list and the reported collisions.

4. Install.

   ```
   evo install --project <project> --profiles base,python
   ```

   If a root entrypoint collision is reported, inspect the existing file, then
   rerun with `--adopt` or `--force`.

5. Verify.

   ```
   evo status --project <project>
   evo doctor --project <project>
   ```

6. Fill in project-owned context. These files are created empty of facts and are
   worthless until completed.

   - `.evo/project/config.toml` project name, environment, profiles, and the
     validation commands that actually exist in this repository. Suggested
     commands are written commented out; enable only what you have verified runs.
   - `.evo/project/context.md` verified architecture, data, integrations,
     environments, and constraints. Verified facts only.
   - `.evo/project/state.md` what works today, what is in flight, known issues.

7. Verify the validation commands actually run.

   ```
   evo validate --project <project>
   ```

   Fix the configuration until every declared command executes. A command that
   does not run is worse than no command, because it will be reported as a
   failure at every checkpoint.

8. Confirm `.evo/runtime/` is ignored.

   ```
   git -C <project> status --short
   ```

   `.evo/runtime/` must not appear. EVO installs `.evo/.gitignore` to cover it.

9. Commit the installation on a short-lived branch through the normal checkpoint
   procedure.

## Verification

- `evo status` reports the expected EVO version, profiles, and no drift.
- `evo doctor` reports no FAIL.
- `evo validate` executes every declared command.
- A model opening the repository finds `EVO.md` at the root.

## Rollback

Remove `.evo/` and the three root entrypoints, and restore any file preserved
under `.evo/project/adopted/`. Nothing else is modified by installation.

## Escalation

Stop and ask a human if the repository already contains a conflicting
instruction system, if the correct profiles are unclear, or if no validation
command in the project actually passes.
