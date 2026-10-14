# Tasks

## 1. Gates

- [x] 1.1 Add the `performanceProbe` fixture: `buildProcessMemoryScript`, `buildMinimizeMemoryScript`, `parseProcessMemory`, `readExtensionProcessMemory` and `getPercentile`. Verify with unit specs for each.
- [x] 1.2 Add `performance.e2e.ts` with the node-latency and background-memory gates. Verify that it passes three runs in a row.

## 2. Documentation and verification

- [x] 2.1 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`:
  - section 13, saying which budgets are gated and where;
  - the M6 item, now done.

  Verify that `openspec validate add-performance-gates --strict` passes.

- [x] 2.2 Run `npm run verify` and confirm that it passes. Verified on the change's own files (e2e typecheck, lint, format, fixture specs, three e2e runs). The full run was blocked by unrelated, uncommitted research-map work in the tree.
