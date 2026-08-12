# TypeScript standard

Authority level 2.

## Configuration

- `strict: true`. Strict mode is not optional.
- No implicit `any`. `any` in new code requires a comment justifying it; prefer
  `unknown` plus narrowing.
- `noUncheckedIndexedAccess` where the codebase can support it.
- Target a Node or browser baseline that the project states explicitly.
- One package manager per repository, with a committed lockfile.

## Types

- Model the domain with types. Prefer discriminated unions over optional-field
  soup.
- Do not use type assertions (`as`) to silence the compiler. An assertion is a
  claim that must be justified or replaced by a runtime check.
- Validate all external data at the boundary with a runtime schema validator,
  then trust the derived type inward. A type from `JSON.parse` is a lie until
  validated.
- Export types for public contracts. Keep internal types internal.

## Style

- ESM modules. No default exports for multi-symbol modules.
- `const` by default. `let` when reassignment is real. Never `var`.
- Named functions for anything that appears in a stack trace.
- No barrel files that create import cycles.
- Enforce style with a linter and formatter in validation, not by review.

## Errors and async

- `async`/`await`, not raw promise chains.
- Every rejected promise is handled. No floating promises.
- Every network call has a timeout and an abort path.
- Errors carry context. Do not throw bare strings.
- Do not swallow errors in a `catch` that only logs at debug level.

## Nullability

- Distinguish `null`, `undefined`, and absent deliberately, and be consistent
  across the codebase.
- Optional chaining and nullish coalescing are for genuinely optional values,
  not for hiding uninitialized state.

## Dependencies

- Every dependency is reviewed. Prefer the platform (fetch, Intl, URL,
  structuredClone) over a package.
- Avoid packages that pull large transitive trees for a small utility.

## Testing

See `standards/testing.md`. Tests are deterministic and do not hit the network.
Type-level correctness is not a substitute for behavioral tests.
