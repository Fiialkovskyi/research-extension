# Tasks

## 1. Capture adjustments

- [x] 1.1 `recordNavigation` treats a commit of the tab's current node URL, ignoring the fragment, as no new page. Extend its spec.
- [x] 1.2 `observePage` answers `content.flush` by sending its batch and resolving after. Extend its spec and `pageSignals` schemas. Add `requestFlush` to `PageSignalsApi`, and wire it in the entrypoint.
- [x] 1.3 `StoredSession` gains `savedTabs`, `lastPosition` and `savedAt`. `setSessionFocus` takes `clearLastPosition`, and `trackActiveDwell` clears it when moving to another node. Extend the specs.

## 2. Library model

- [x] 2.1 Add `researchLibrary/model/saveActiveSession`. Its spec covers:
  - ordered tabs with nodes;
  - "left off at" taken from focus and from the latest focused node;
  - nodes closed;
  - the status saved;
  - the tab ids returned;
  - nothing without an active session.
- [x] 2.2 Add `closeTabsKeepingWindow`. Its spec covers a window keeping other tabs, and a window that would empty getting a new tab first.
- [x] 2.3 Add `listSavedSessions`. Its spec covers the order, page counts, `lastPosition`, and closed and active sessions excluded.
- [x] 2.4 Add `resumeSession`. Its spec covers:
  - tabs in order, discarded except the left-off one;
  - the group titled;
  - nodes reopened on the new tab ids;
  - the session active with the former group recorded;
  - refusal while active;
  - a closed session ended;
  - a failure removing the tabs it opened.

## 3. Background and popup

- [x] 3.1 Add the schemas for `session.save`, `library.list` and `session.resume`, and their answers. Add `lastPosition` in the session summary.
- [x] 3.2 `app/backgroundApp` handles them per design.md: flush, then the capture-queue save, then closing the tabs; resume on the queue, then a push. Add the dependencies `resumeApi` and `closeTabs`. The specs cover:
  - a save that keeps a scroll sent at flush time;
  - the tabs closed;
  - resume reopening nodes without new ones;
  - a refused resume.
- [x] 3.3 Popup:
  - "Save research" while active;
  - the library with Resume and confirmed Delete when no session is active;
  - the "left off at" line.

  Add specs.

## 4. End-to-end and documentation

- [x] 4.1 Add `e2e/specs/saveAndResume.e2e.ts`:
  1. Save a session with two pages. Its tabs close and the popup lists it.
  2. Resume it. The group returns with both tabs, one discarded, the database has no new nodes, and the popup says where the user left off.

  Verify that `npm run test:e2e` passes.

- [x] 4.2 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`: STO-003 to STO-005 note what is built, and that the library lives in the popup. Verify that `openspec validate add-save-and-resume --strict` passes.
- [x] 4.3 Run `npm run verify` and confirm that it passes.
