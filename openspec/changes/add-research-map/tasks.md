# Tasks

## 1. Dependencies

- [x] 1.1 Add `@xyflow/react` (12.x) and `@dagrejs/dagre` (3.x) as pinned dependencies with the lockfile updated. Verify that both ship TypeScript types and make no network calls (no `fetch`/`XMLHttpRequest` in their dist), and that `npm run typecheck` passes.

## 2. Map model

- [x] 2.1 Add `src/features/researchMap/`:
  - `constants.ts`: `MAP_PAGE_PATH`, the node box size and the dagre spacing;
  - `schemas.ts`: requests `graph.subscribe`, `tab.focus`, `map.open`; responses `graph.snapshot`, `tab.focused`, `tab.focusRefused`, `map.opened`;
  - `types.ts`;
  - a barrel that exports no `ui/` and not `buildMapLayout`, with a comment saying why.

  Verify with `npm run typecheck`.

- [x] 2.2 `buildGraphSnapshot(session, graph)` with a spec: it keeps only the drawn fields, `session: null` gives an empty graph, and the result passes the `graph.snapshot` schema.
- [x] 2.3 `buildMapLayout(snapshot)` with a spec:
  - a child is below its parent, and an opened tab below its opener;
  - positions are top-left;
  - edge classes are `edge-sameTab` and `edge-opener`, and opener edges are dashed;
  - an empty snapshot gives no nodes;
  - the title falls back to the URL.

## 3. Background

- [x] 3.1 `backgroundApp`, subscriptions:
  - `BackgroundPort` gains `onDisconnect`;
  - `graph.subscribe` registers the port and pushes a snapshot at once;
  - capture handlers, `tabGroup.create`, group update and removal, and `reconcileSession` enqueue at most one pending push on the capture queue;
  - a push with no subscribers reads nothing;
  - a disconnected or throwing port is dropped.

  Extend `index.spec.ts`:
  - a push follows the write that caused it;
  - a burst of three events produces at most two pushes;
  - a session ended pushes `session: null`.

- [x] 3.2 `backgroundApp`, `tab.focus` and `map.open`:
  - new dependencies `focusTab(tabId)` and `openMap()`;
  - `tab.focus` is refused unless the active session has an open node for the tab.

  Specs cover:
  - an open node is focused;
  - a closed node, a foreign tab and no session are each refused, with no `focusTab` call;
  - `map.open` calls `openMap`.

- [x] 3.3 Entrypoint wiring:
  - `focusTab` is `tabs.update` + `windows.update`;
  - `openMap` finds the map tab by URL prefix and focuses it, or creates it without an opener and ungroups it if it landed in a group.

  Verify with `npm run typecheck` and the e2e in group 6.

## 4. Map page

- [x] 4.1 `src/features/researchMap/ui/ResearchMap` and its node component, per design.md:
  - an open node is a `<button>` with `data-testid="map-node"`, `data-node-id` and `data-tab-state`;
  - a closed node is not interactive and is labelled `closed`;
  - `colorMode="system"`;
  - `fitView` runs only on the first snapshot.

  Add a render spec using React Flow's jsdom stubs, covering:
  - the buttons appear;
  - clicking an open node calls `onFocusNode`;
  - a closed node has no button.

- [x] 4.2 `src/app/mapApp`: subscribes over a `SurfaceClient` and parses messages against `researchMap` and `rpc` response schemas. Its states are `loading`, `empty` (`No active research session.`) and `ready`, and a `tab.focusRefused` reason is shown inline. Specs cover each state, a snapshot replacing the previous one, and a refused focus.
- [x] 4.3 `src/entrypoints/map/` (`index.html`, `main.tsx`): wiring only, with a port client and the React Flow stylesheet. Verify after `npm run build:firefox` that `.output/firefox-mv3/map.html` exists and references only package files. Record the map, background and popup chunk sizes in design.md; the background and popup must not contain React Flow.

## 5. Popup

- [x] 5.1 `popupApp`: in the active state, add an `Open map` button (`data-testid="open-map"`) that sends `map.open`. Specs cover: the button is shown only while a session is active, and clicking it sends `map.open`.

## 6. End-to-end

- [x] 6.1 Fixtures:
  - `firefoxToolbar`: a helper that clicks a popup button by test id, with its script builder unit tested;
  - a new `researchMap` fixture: `readResearchMap()` returns nodes with id, title, tab state and position, and edges with id and kind, read from the map tab's DOM; `waitForMapNodes(count, timeout)`.

  Pure parts carry unit specs.

- [x] 6.2 `e2e/specs/researchMap.e2e.ts`, covering every scenario in `specs/research-map/spec.md`:
  - The popup opens the map outside the session's group, and no node is recorded for it. Opening it again selects the same tab.
  - With A → B in the session tab and B opening C, the map shows A closed, B and C open, a `sameTab` edge A→B and an `opener` edge B→C, and B is below A and C below B.
  - With the map open, loading a page in the session tab shows the new node within 1 s.
  - Clicking open node B selects B's tab; pressing Enter on a focused node does the same; clicking closed node A changes nothing.
  - Closing the session's group makes the map say that no session is active.
  - With no session, the popup has no `Open map` button and the map shows the empty state.

## 7. Spec and verification

- [x] 7.1 Amend `RESEARCH_GRAPH_EXTENSION_SPEC.md` §11: the Research map is implemented with React Flow + dagre; record the reason and the conditions under which sigma.js would replace it.
- [x] 7.2 Run `npm run verify` and `openspec validate add-research-map`.
