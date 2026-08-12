# Frontend patterns

Authority level 2. Proposed Evolium standard patterns.

## Feature modules

Organize by feature. A feature owns its routes, components, data access, state,
types, and tests. Cross-feature reuse goes through a shared layer with an
explicit contract, not by importing another feature's internals.

```
src/
  features/<feature>/{components,api,hooks,types,tests}
  shared/{ui,lib,types}
  app/{routes,providers}
```

## Layering

```
route / page        composition and data orchestration
  view components   presentation, no transport
  hooks             stateful behavior, reusable
  api client        transport, typed, validated at the boundary
```

Presentational components receive data and callbacks. They do not fetch, do not
know about auth, and do not contain business rules.

## Data access

- One typed API client per backend surface. Validate responses at the boundary.
- A data-fetching layer owns caching, deduplication, retry, and invalidation.
  Do not hand-roll this per component.
- Server state lives in the fetching layer's cache, not duplicated into a global
  store.

## State classification

- **Server state** owned by the fetching layer.
- **URL state** filters, tabs, pagination, selection. Anything a user would
  expect to share via link.
- **Local UI state** transient, component-scoped.
- **Global client state** rare, and justified: auth session, theme, feature
  flags.

Misclassified state is the most common source of frontend defects.

## Error and loading boundaries

Route-level error boundaries catch unexpected failures. Data-level states
(loading, empty, error, partial) are handled where the data is used. A blank
screen on failure is a defect.

## Authorization

The server enforces authorization. The client reflects it. Route guards and
hidden controls are usability, not security.

## Design system

Shared primitives are versioned and their props are a contract. Feature code
does not fork a primitive; it extends the primitive or proposes a change to it.
