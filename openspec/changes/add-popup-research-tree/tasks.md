# Tasks

## 1. Shared display and snapshot

- [x] 1.1 Move the engagement words and markers to `shared/config` (`ENGAGEMENT_DISPLAY`), and make `MapPageNode` use them. The map's specs must pass unchanged.
- [x] 1.2 Add `copyEvents` to `mapNodeSchema` and `buildGraphSnapshot`, and update their specs and every snapshot fixture.

## 2. Tree model

- [x] 2.1 Add `researchTree/model/buildResearchTree`. Its spec covers:
  - the parent before the opener;
  - a missing parent making a root;
  - sibling order;
  - the spec's search, result and link scenario;
  - a node met twice.
- [x] 2.2 Add `listVisibleRows`, with a spec for levels, positions, set sizes and `hasChildren`, and for collapsed children being hidden.
- [x] 2.3 Add `moveTreeFocus`. Its spec covers every key:
  - Down and Up at the ends;
  - Right on a collapsed row, an expanded row and a leaf;
  - Left on an expanded row, a child and a root;
  - Home and End.
- [x] 2.4 Add `listUnreadPages`, with a spec for closed pages excluded and oldest first.

## 3. Components and popup

- [x] 3.1 Add `researchTree/ui/researchTree`. The Testing Library specs cover:
  - the ARIA roles and attributes;
  - the roving tab index;
  - keys moving focus and collapsing;
  - Enter and click on an open row calling `onFocusTab`, and on a closed row not;
  - the copy marker's accessible name;
  - the closed label;
  - a search's label.
- [x] 3.2 Add `researchTree/ui/unreadQueue`, with specs for the count, the order, the empty state and activation.
- [x] 3.3 `app/popupApp`:
  - take a `graph` stream;
  - while active, subscribe and render the queue and the tree under the session;
  - keep the collapsed rows and the focus across snapshots;
  - send `tab.focus` on activation.

  Its specs push two snapshots through a fake stream, and check that no tree shows without a session. Update every existing render.

- [x] 3.4 `entrypoints/popup`: open a port and pass it as `graph`. Verify with `npm run typecheck` and a build.

## 4. End-to-end and documentation

- [x] 4.1 Extend the popup reader with `treeRows`, `unreadCount` and `unreadPages`, and update its parser and specs.
- [x] 4.2 Add `e2e/specs/popupResearchTree.e2e.ts` with the scenario from design.md, and verify that `npm run test:e2e` passes.
- [x] 4.3 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`:
  - the UI table's sidebar row and the M1 line say the tree lives in the popup;
  - UI-001 and UI-002 name the popup;
  - UI-003 is noted as applying to the first destructive action.

  Verify that `openspec validate add-popup-research-tree --strict` passes.

- [x] 4.4 Run `npm run verify` and confirm that it passes.
