# UI/UX standard

Authority level 2.

## Required states

Every view that loads or mutates data implements, explicitly:

- **loading** with a stable layout that does not shift when content arrives
- **empty** explaining what the user can do, not just "no data"
- **error** stating what failed and what the user can do next, with a retry
  where retry is safe
- **loaded** the normal case
- **partial** when some data resolved and some failed

A view missing empty or error handling is incomplete, not polished later.

## Feedback

- Every user action produces visible feedback within a perceptible interval.
- Destructive actions require confirmation and name what will be destroyed.
- Long operations report progress or at least that they are still running.
- Failures are surfaced to the user, not only to the console.

## Forms

- Labels are visible, not placeholder-only.
- Validation messages are specific and adjacent to the field.
- Errors appear after the user has had a chance to complete the field, not on
  every keystroke from the first character.
- Submit is disabled while in flight and re-enabled on failure.
- Entered data survives a failed submit.

## Layout

- No horizontal overflow of the page body. Wide content scrolls inside its own
  container.
- Responsive down to the smallest supported viewport the project declares.
- Do not depend on hover for essential information; touch devices have no hover.
- Text remains legible at 200 percent zoom.

## Accessibility baseline

- Semantic HTML first. ARIA only where semantics are insufficient.
- Every interactive element is keyboard reachable and operable, in a logical
  order, with a visible focus indicator.
- Form controls have programmatic labels.
- Color is never the only carrier of meaning.
- Contrast meets WCAG AA for text and interactive boundaries.
- Images and icons that convey meaning have text alternatives.

## Consistency

- One design system per product surface. Ad hoc spacing, color, and typography
  values are defects.
- Terminology is consistent across the product; the same concept keeps the same
  name.

## Review

The `ui-ux-reviewer` contract applies to user-visible changes. Browser tooling
is used when the project has configured it. EVO does not require Playwright or
any specific browser tool in every project; the project declares its UI
validation commands in `.evo/project/config.toml`.

When browser tooling is available, evaluate: console errors, navigation, broken
interactions, layout overflow, responsive behavior, loading and empty and error
states, form behavior, primary workflows, accessibility basics, and visual
regressions.
