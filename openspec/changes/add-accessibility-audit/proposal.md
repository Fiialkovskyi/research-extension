# Proposal

## Why

Section 13 asks for an accessibility audit before beta. The pages were built with labels and roles
by hand, but nothing checked them. A regression, such as an unlabelled input or low contrast in a
new card, would ship unnoticed.

## What Changes

- **An accessibility e2e.**
  - The new `accessibilityAudit` fixture runs axe-core inside each extension page in the real
    Firefox, so contrast and layout are judged on the shipped styles rather than in jsdom.
  - The rules are WCAG 2.0 and 2.1, levels A and AA.
  - `accessibility.e2e.ts` starts a session with a recorded page, then audits the popup, options,
    Synthesis, "What was recorded" and map pages. For each page it asserts no violation and that
    the page rendered content.
  - A control plants an image without alt text and asserts that the audit reports it, so a run
    that audits nothing cannot pass.
- **axe-core as a dev dependency.** It is read from `node_modules` by the suite, never bundled into
  the extension.

The first run found no violations, so no page changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `extension-shell`: every extension page passes an automated WCAG 2 A and AA audit in the suite.

## Impact

- **Code:**
  - `e2e/fixtures/accessibilityAudit/`;
  - `e2e/specs/accessibility.e2e.ts`;
  - `axe-core` in `devDependencies`.
- **Not covered:**
  - keyboard-only walkthroughs;
  - screen-reader announcements;
  - the dark theme.

  These are left as a manual check.
