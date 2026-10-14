# Tasks

## 1. Egress suite

- [x] 1.1 Add the `egressLog` fixture: the recorder, reader and probe scripts, `parseEgressLog`, `findExtensionEgress`, and the chrome-context wrappers. Verify with unit specs for each.
- [x] 1.2 Add `egress.e2e.ts`: a positive control, then a whole session asserting no egress. Verify that it passes against the packaged build.

## 2. The Ollama gate

- [x] 2.1 Add `isOllamaAccessGranted`, and use it for `hasOllamaAccess` in the background entrypoint. Verify with its spec and the egress e2e, which failed before the fix with requests to `/api/tags` and `/api/show`.

## 3. Documentation and verification

- [x] 3.1 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`:
  - section 13's egress row, as built;
  - REQ-SEC-001a's gate;
  - the M6 item, marking the egress suite done.

  Verify that `openspec validate add-egress-suite --strict` passes.

- [x] 3.2 Run `npm run verify` and confirm that it passes.
