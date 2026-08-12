# Runbook: release validation

Owner: Evolium engineering
Environment: staging, production

Assess and execute a release. Passing tests are not readiness.

## Preconditions

- The change set to be released is identified, on `main` or on a branch merging
  to it.
- `.evo/project/config.toml` declares the project's validation commands.
- The deployment and rollback procedures for this project exist and are current.

## Safety

Production deployment requires explicit human authorization. Irreversible steps
(destructive migrations, data deletion, external side effects) require separate
authorization per action and must be identified before starting.

## Procedure

1. Establish the change set.

   ```
   git log --oneline <last-release-tag>..HEAD
   git diff --stat <last-release-tag>..HEAD
   ```

2. Run the full deterministic validation. Do not skip because it was run
   earlier on a different commit.

   ```
   evo validate --project <project>
   ```

   Record the result. A required failure stops the release.

3. Inventory the migrations in the change set. For each: is it safe on live
   data, is it expand-then-contract where it is breaking, is it reversible, and
   has it been tested against a realistic schema.

4. Inventory configuration and secrets the release requires. Confirm each key
   and each secret exists in the target environment before deploying. Do not
   read secret values; confirm presence.

5. Confirm deployment prerequisites: infrastructure, permissions, capacity,
   dependent service versions, and deployment order across components.

6. Apply the `release-validator` contract from `.evo/core/agents/`. Resolve
   every critical and high finding, or obtain explicit human acceptance.

7. Confirm the rollback plan is specific and names what it cannot undo.

8. Obtain explicit human authorization for the deployment.

9. Deploy following the project's deployment procedure.

10. Verify after deploy, using the project's post-deploy verification, not the
    absence of errors alone.

## Verification

- Required validations passed on the exact commit being released.
- Migrations applied as planned.
- Post-deploy verification succeeded.
- Error rate, latency, and integration health are within normal range after the
  release.

## Rollback

Execute the project's documented rollback. If the release included an
irreversible step, rollback restores code but not data; state that explicitly
before deploying, not during an incident.

## Escalation

Stop and escalate on: a failing required validation, an unresolved critical or
high finding, a migration with no rollback path, missing configuration or
secrets in the target environment, or any unexpected behavior during
verification.
