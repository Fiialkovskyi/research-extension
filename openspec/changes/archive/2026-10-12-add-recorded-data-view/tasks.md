# Tasks

## 1. Storage

- [x] 1.1 Raise `DATABASE_VERSION` to 12, with a step adding the `sessionId` indexes on `snapshots`, `chunks`, `vectors` and `jobs`, and the `nodeId` index on `vectors`. Update the schema types, and extend the migration spec, including a version-11 profile's records being found through the new indexes.

## 2. Model

- [x] 2.1 Add `recordedData/model/readRecordedSession` and `readRecordedText`. The specs cover:
  - entries with signals, snapshot facts and vector counts;
  - no text in the summary;
  - the text read back;
  - nodes of other sessions refused;
  - no live session.
- [x] 2.2 Add `deleteNode`. Its spec covers the node, its edges both ways, the snapshot, chunks, vectors in two spaces and its job all gone; another node's records untouched; and an unknown node returning `false`.
- [x] 2.3 Add `deleteSession`. Its spec covers every session-scoped store being emptied of the session, another session untouched, and spaces kept.

## 3. Background and messages

- [x] 3.1 Add the request and response schemas in `recordedData/schemas.ts`, and merge them into `requestSchemas`.
- [x] 3.2 Handle `recorded.read`, `recorded.readText`, `node.delete`, `session.delete` and `recorded.open` in `app/backgroundApp`. Deletions run on the capture queue and push afterwards, and a node deletion reclusters. Add the new `openRecordedPage` dependency, and wire it in the entrypoint. The specs cover each request, and that the deleted session is no longer active.

## 4. Surfaces

- [x] 4.1 Add `recordedData/ui/confirmDelete`, with specs for first press, confirm and cancel.
- [x] 4.2 Add `recordedData/ui/recordedPage`, with specs for an entry's values, showing text on request, and the delete controls calling back.
- [x] 4.3 Add `app/recordedApp` and `entrypoints/recorded` (wiring). Specs with a fake client cover loading, reading again after a deletion, and the empty state.
- [x] 4.4 Popup: a "What was recorded" button while a session is active or closed, sending `recorded.open`. Add specs.

## 5. End-to-end and documentation

- [x] 5.1 Add an `e2e/fixtures/recordedPage` fixture (reader script, parser, click helper), with specs.
- [x] 5.2 Add `e2e/specs/recordedData.e2e.ts` with the scenario from design.md, and verify that `npm run test:e2e` passes.
- [x] 5.3 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`:
  - SEC-008 and STO-008 say what is built;
  - UI-003 names confirmation as the option taken.

  Verify that `openspec validate add-recorded-data-view --strict` passes.

- [x] 5.4 Run `npm run verify` and confirm that it passes.
