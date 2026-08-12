# Testing standard

Authority level 2.

## Principle

AI-assisted engineering increases implementation speed. Verification must
therefore become stronger, not lighter. The test suite is the mechanism by which
generated code is trusted.

Tests correspond to actual risk. Not every change needs every class of test. No
change needs meaningless tests written to inflate coverage.

## Classes of test

- **Unit** a single unit of logic, no I/O, fast, deterministic. The default.
- **Integration** real boundaries inside our control: database, queue, internal
  service. Required when the change crosses one of those boundaries.
- **Regression** a test that reproduces a specific defect and fails without the
  fix. Required for every bug fix. A bug fix without a regression test is not a
  fix, it is a change.
- **API contract** required when a public contract changes.
- **Database migration** required for every migration: forward, and rollback
  where a rollback exists.
- **Failure path** timeouts, upstream errors, partial failure, retry exhaustion,
  malformed input. Required wherever the system depends on an external party.
- **Security / adversarial** authorization bypass, tenant crossing, injection,
  prompt injection where a model is in the loop. Required when the change is
  security-relevant.
- **Browser / end to end** for primary user workflows, when the project has
  configured the tooling. Kept few and stable.
- **Property-based** when the input space is large and invariants are clear.
  Justified, not routine.
- **Mutation** to audit suite quality in a critical module. Justified, not
  routine.

## Requirements

- Tests are deterministic. No dependence on wall-clock time, ordering, locale,
  network, or leftover state.
- Tests do not reach external networks. External systems are faked at a defined
  seam with a contract that is itself tested.
- Tests are isolated. Use temporary directories and disposable databases. A test
  must not modify the working repository or a developer's environment.
- Test names state the behavior being asserted.
- One reason to fail per test where practical.
- Fixtures are synthetic. Production data never enters a test.

## What not to do

- Do not assert on implementation details that a valid refactor would break.
- Do not write tests that pass regardless of the behavior under test.
- Do not chase a coverage number with trivial tests.
- Do not disable, skip, or weaken a failing test to reach green. A skipped test
  is a finding at checkpoint review.
- Do not mock the unit under test.

## Coverage

Coverage is a diagnostic, not a target. Low coverage in a risky module is a
finding. High coverage is not evidence of correctness.

## Validation integration

Test commands are declared in `.evo/project/config.toml` and executed by
`evo validate`. EVO does not infer or hardcode a test runner. Required
validations block a checkpoint; optional validations warn.
