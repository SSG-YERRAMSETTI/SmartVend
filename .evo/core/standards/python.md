# Python standard

Authority level 2.

## Version and tooling

- Target Python 3.11 or newer.
- Manage dependencies with a lockfile. Pin direct dependencies.
- Use a virtual environment per project. Never install project dependencies
  globally.
- Prefer the standard library. Justify every third-party runtime dependency
  against `knowledge/approved-technologies.md`.

## Layout

- `src/` layout for packages. Tests in `tests/`, outside the package.
- One module, one responsibility. Modules that need "utils" in the name usually
  need splitting.
- No import-time side effects beyond definitions. No network, filesystem, or
  environment reads at import time.
- Entry points via `[project.scripts]`, not ad hoc scripts at the repo root.

## Style

- Follow PEP 8. Enforce with a formatter and a linter configured in the project,
  not by hand.
- Type hints on all public functions and on non-obvious internals. Run a type
  checker in validation.
- `pathlib.Path` for filesystem paths. Never string concatenation of paths.
- f-strings for formatting. No `%` formatting in new code.
- `dataclasses` for structured records. Reach for a validation library only when
  external input requires schema validation.
- Prefer explicit `if x is None` over truthiness when `None` and empty are
  different.

## Errors

- Raise specific exceptions. Define a project base exception and derive from it.
- Never use a bare `except:`. Never swallow an exception without either
  re-raising, logging with context, or returning a documented degraded result.
- Do not use exceptions for expected control flow across module boundaries.
- Attach context to errors: which resource, which identifier, which operation.
  Never attach secrets.

## Concurrency and I/O

- Do not mix blocking I/O into async code paths. Blocking work goes to a thread
  or process executor.
- Every outbound network call has an explicit timeout. A call without a timeout
  is a defect.
- Retries use bounded attempts with backoff, and only for idempotent
  operations.

## Subprocess and shell

- Use argument arrays with `subprocess.run`. Do not use `shell=True`.
- Never interpolate untrusted input into a command.
- Always set a timeout.

## Logging

- Use the `logging` module. No `print` in library or service code.
- Structured logging where the platform supports it.
- Never log secrets, tokens, credentials, or unredacted PII.

## Testing

- `pytest` or standard-library `unittest`. The project declares which. Tooling
  that ships with the standard library is preferred when it is sufficient.
- Tests are deterministic, isolated, and do not require network access.
- Use temporary directories, not the working tree, for filesystem tests.
- See `standards/testing.md`.

## Packaging

- `pyproject.toml` is authoritative. Version declared in one place.
- No runtime dependency on development or test tooling.
