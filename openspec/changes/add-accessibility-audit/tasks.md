# Tasks

## 1. Audit

- [x] 1.1 Add `axe-core` as a dev dependency and the `accessibilityAudit` fixture (`readAxeSource`, `buildAxeAuditScript`, `parseAxeViolations`, `auditExtensionPage`). Verify with unit specs for each.
- [x] 1.2 Add `accessibility.e2e.ts`: the planted-violation control, then every page with no violation and rendered content. Verify that it passes against the packaged build.

## 2. Documentation and verification

- [x] 2.1 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`: mark the accessibility audit done in M6, and note how it runs in section 13. Verify that `openspec validate add-accessibility-audit --strict` passes.
- [x] 2.2 Run `npm run verify` and confirm that it passes.

## Deferred

- [ ] Manual check:
  - a keyboard-only walkthrough of the popup, options and Synthesis pages;
  - VoiceOver on the popup tree;
  - the dark theme's contrast.
