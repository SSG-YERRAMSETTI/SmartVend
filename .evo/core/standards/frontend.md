# Frontend standard

Authority level 2.

## Structure

- Organize by feature, not by file type. A feature owns its components, hooks,
  state, and tests.
- Shared UI primitives live in one place and are versioned as a contract.
- Components render; they do not own transport, auth, or business rules.
- Keep component files small enough to read in one pass. A component with many
  responsibilities is a module boundary that has not been drawn yet.

## State

- Distinguish server state, URL state, and local UI state. Do not store server
  state in a global client store by hand when a data-fetching layer already
  models loading, error, and cache invalidation.
- URL is state. Filters, tabs, pagination, and selected entities belong in the
  URL when the user would expect a link to reproduce the view.
- Derive rather than duplicate. Duplicated state drifts.

## Data fetching

- Every request has a timeout and an error path.
- Every asynchronous view models four states explicitly: loading, empty, error,
  loaded. A view that only handles the happy path is incomplete.
- Do not fetch in a loop. Do not fetch the same resource from several components
  without a shared cache.
- Show optimistic updates only when rollback is implemented.

## Rendering and performance

- Avoid unnecessary re-render cascades; measure before optimizing.
- Virtualize long lists.
- Lazy-load routes and heavy components.
- Do not ship large dependencies for small effects. Watch bundle size in
  validation when the project configures it.

## Forms

- Validate on the client for usability and on the server for correctness. Client
  validation is never the security boundary.
- Preserve user input on failure. Never clear a form on a server error.
- Disable submit while a submission is in flight; prevent duplicate submits.

## Security

- Never render untrusted HTML without sanitization.
- Never place secrets, API keys, or tokens in frontend code or the bundle.
- Tokens in browser storage are a documented risk decision, not a default.
- Authorization decisions are enforced server side. Hiding a button is not
  access control.

## Accessibility baseline

Semantic elements, labeled controls, keyboard reachability for every
interactive element, visible focus, sufficient contrast, and meaningful
alternative text. See `standards/ui-ux.md`.

## Testing

Behavior over implementation detail. Test what the user does. Browser and
end-to-end tests are declared by the project, not assumed. See
`standards/testing.md`.
