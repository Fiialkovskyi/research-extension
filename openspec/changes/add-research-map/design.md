# Design

## Context

- **Graph data.** Capture writes the graph into the database (v5). `researchGraph.readSessionGraph` returns a session's nodes and edges from one read-only transaction.
  - A node has `parentNodeId` (previous page in the same tab), `openerNodeId`, `tabId`, `tabState`, `title`, `url` and `domain`.
  - Edge ids are `from|to|kind`, where `kind` is `sameTab` or `opener`.
- **Background app.** Capture events run through one serial promise queue (`enqueueCapture`).
  - Session events are separate handlers: `tabGroup.create`, `handleGroupUpdated/Removed`, `reconcileSession`.
  - `attachPort` already relays requests and streamed `emit` messages over a port. It does not yet notice a port disconnecting.
- **Surfaces.**
  - The popup talks to the background with one-shot messages.
  - The options page holds a port.
  - Both are React 19 + Tailwind, mounted from a wiring-only entrypoint and a composition root in `app/`.
- **Spec and budget.** The target spec names graphology + sigma.js for the map. React Flow was chosen with the user instead (see Decisions). REQ-UI-007 exempts the map's graph library from the 300 KB per-page budget.
- **WXT.** It builds `src/entrypoints/map/index.html` as the unlisted page `map.html`.

## Goals / Non-Goals

**Goals:**

- A readable picture of the captured graph, good enough to judge capture by eye.
- Everything the map shows comes from the background over the RPC envelope. The page writes nothing.
- The map is testable in e2e from the DOM, without a test-only hook.

**Non-Goals:**

- Incremental patches: the full snapshot is pushed on every change.
- A stable layout between snapshots: nodes may move when the graph grows.
- Performance targets beyond a few hundred nodes.

## Decisions

### React Flow + dagre, not sigma.js or ECharts

React Flow draws each node as a React component in the DOM. That gives:

- keyboard focus and a real `<button>` per node (REQ-UI-002);
- Tailwind styling;
- `data-testid` attributes that unit tests and e2e read directly.

dagre lays the graph out top-down, so the chain of pages reads like a history.

**Alternatives considered:**

- **sigma.js**, the spec's choice: WebGL scales to thousands of nodes, but canvas hides nodes from tests and from the keyboard, and its force layouts read poorly as a history.
- **ECharts graph series**: canvas or SVG with no focusable nodes, a larger bundle, and the layout would still be dagre.

If the map later has to show thousands of nodes, moving to sigma replaces only the UI component. The snapshot message and the layout input stay.

### One snapshot message, pushed over a port

The map connects a port and sends `graph.subscribe`. From then on the background pushes `graph.snapshot` on that port:

- once right away;
- then after every change to the session or its graph.

The snapshot payload is `{ session: { id, title } | null, nodes, edges }`:

- `nodes` carry only what the map draws: `id`, `title`, `url`, `domain`, `tabId`, `tabState`, `parentNodeId`, `openerNodeId`, `transitionType`, `createdAt`;
- `edges` carry `id`, `from`, `to` and `kind`.

`buildGraphSnapshot` builds it from the stored session and graph, and a valibot schema in `researchMap/schemas.ts` checks it on arrival.

**Alternatives considered:**

- **A `graph.changed` notification plus a `graph.get` refetch:** two round trips for the same result.
- **`runtime.sendMessage` broadcasts:** they reach the popup too, and fail with no receiver.
- **The spec's `graph.patch`:** deferred. A snapshot of a few hundred nodes is small, and patches need ordering and resync logic that this change does not need.

The port has a side effect: an open map keeps the event page alive. For a page the user is looking at, that is acceptable and is the same trade-off the options page already makes.

### When a snapshot is pushed

The background app keeps a set of subscribed ports. Several things mark the graph changed:

- every capture handler;
- `tabGroup.create`;
- `handleGroupUpdated` and `handleGroupRemoved`;
- `reconcileSession`.

A change enqueues **one** push job on the capture queue, unless a push is already waiting there. The background counts the capture writes it queues, and the push records the count it was queued at. When the push reaches the head of the queue and more writes have been queued behind it since, it does not read. It re-queues itself at the tail instead. So:

- a push always runs after the writes that caused it, because the queue is serial;
- a burst of events, such as a commit, a title and a focus, ends in one push rather than one per event.

Found during implementation: the first version only skipped a change while a push was waiting. That left a waiting push ahead of a newer write in the queue, and it pushed a graph without that write. The unit test "pushes a snapshot that already holds the write that caused it" covers this.

The push reads the active session (`getActiveSession`, no reconciliation) and its graph once, and posts the same snapshot to every subscriber. With no subscribers nothing is read.

A port is removed from the set on `onDisconnect`. `BackgroundPort` gains `onDisconnect` for this. A `postMessage` that throws because the port has gone also removes it.

### Focusing a tab

`tab.focus { tabId }` is accepted only when the active session has an **open** node for that tab (`readTabNode`). It is answered with `tab.focused` or `tab.focusRefused { reason }`. The background then calls a new dependency, `focusTab(tabId)`, which the entrypoint implements as:

1. `tabs.update(tabId, { active: true })`;
2. `windows.update(tab.windowId, { focused: true })`.

The check keeps the map from being a general "select any tab" channel. It also makes a click on a closed node a no-op in the background, not only in the UI.

### Opening the map

`map.open` from the popup makes the background call the dependency `openMap()`. The entrypoint passes the browser's tab calls to `researchMap.openMapTab` and narrows tabs with `readMapTab`. Both are unit tested. The rule:

- **Map tab already open:** it looks through `tabs.query({})` for a tab whose URL starts with the map page URL. Match patterns do not cover `moz-extension:`. It then selects that tab and focuses its window.
- **No map tab:** it calls `tabs.create({ url })` with no `openerTabId`, so Firefox does not insert it as a related tab beside the selected, possibly grouped, tab.
  - If the new tab nevertheless reports a `groupId` other than `-1`, it is ungrouped with `tabs.ungroup`.
  - Capture would ignore it anyway: `moz-extension:` is not capturable. But a tab in the group would look like part of the research.

The page's path lives in `researchMap/constants.ts` as `MAP_PAGE_PATH`.

### Layout

`buildMapLayout(snapshot)` is a pure function that returns React Flow `nodes` and `edges`.

- **dagre settings:** `rankdir: "TB"`, a fixed node box (240 × 64), and `nodesep`/`ranksep` constants.
- **Positions:** both edge kinds feed the layout, so an opened tab sits below its opener. dagre returns centres; positions are shifted to React Flow's top-left origin.
- **Edges:**
  - every edge carries a class `edge-sameTab` or `edge-opener`;
  - an opener edge is dashed;
  - both end in an arrow.
- **Snapshots:** each snapshot is laid out from scratch. `fitView` runs only on the first snapshot, so later updates do not reset the user's pan and zoom.

### The map page

`app/mapApp` is the composition root. It:

- takes a `SurfaceClient` like the options page;
- sends `graph.subscribe`;
- parses every incoming message against `researchMap` and `rpc` response schemas;
- keeps the last snapshot in state.

Its states are `loading`, `empty` (no session) and `ready`, plus the last `tab.focusRefused` reason, if any, shown inline.

`researchMap/ui/ResearchMap` renders `<ReactFlow>` with:

- `colorMode="system"`;
- nodes not draggable, not connectable and not selectable;
- `nodesFocusable={false}`.

Focus belongs to the node's own control instead:

- an open node renders a `<button>` (`data-testid="map-node"`, `data-node-id`, `data-tab-state`) that sends `tab.focus`;
- a closed node renders the same box as a non-interactive element with the word `closed`.

`@xyflow/react/dist/style.css` is imported by the map entrypoint only.

### Layering and bundles

- `features/researchMap/index.ts` exports the schemas, constants, `buildGraphSnapshot` and `buildMapLayout`.
- The barrel exports no `ui/`, and its comment says why: the background imports the barrel and must not pull React Flow.
- `buildMapLayout` imports dagre, which is plain JavaScript of about 30 KB. It is only used by the map, so it is imported by path from `app/mapApp` and kept out of the barrel for the same reason.

After the build, the background and popup chunk sizes must be unchanged apart from the new message handling.

Measured with `npm run build:firefox`:

| Chunk                                          | Raw    | Gzipped |
| ---------------------------------------------- | ------ | ------- |
| `chunks/map-*.js` (React Flow, dagre, the map) | 229 KB | 74 KB   |
| `assets/map-*.css`                             | 15 KB  | 2.6 KB  |
| `background.js`                                | 48 KB  | 16 KB   |
| `chunks/popup-*.js`                            | 3.2 KB | 1.5 KB  |

Neither `background.js` nor the popup chunk contains `xyflow` or `dagre`. The built `map.html` references only package files.

## Risks / Trade-offs

- **[React Flow needs `ResizeObserver` and DOM measurement, which jsdom lacks.]** → Unit tests cover `buildMapLayout`, `buildGraphSnapshot` and `mapApp`'s state handling, with React Flow's documented jsdom stubs where a render is needed. Rendering, edges, positions and clicks are covered in e2e against real Firefox.
- **[Edges to nodes added by a later snapshot were not drawn.]** Found in e2e. React Flow attaches an edge only to a node whose size and handle positions it knows, and it forgets both when a node object is replaced, which every snapshot does. The box keeps its size, so the ResizeObserver does not fire again and the node is never re-measured. Applying React Flow's node changes (`applyNodeChanges`) fixed only some runs. `buildMapLayout` therefore declares each node's `measured` size and its two `handles`: the box is fixed, so both are known in advance. jsdom cannot reproduce the problem. `researchMap.e2e.ts` covers it by drawing edges between pages added while the map is open, run repeatedly.
- **[Nodes move when the graph grows, because each snapshot is laid out from scratch.]** → Accepted for a checking tool. Stable incremental layout belongs with `graph.patch`.
- **[An open map keeps the event page alive.]** → Accepted. The page is only alive while the user has the map open.
- **[The 1 s update target in e2e.]** → The push is queued right after the write, so the expected latency is tens of milliseconds. The e2e wait uses the spec's 1 s bound, and its failure message says which update was late.
- **[React Flow's attribution link points to an external site.]** → It is a plain anchor and loads nothing. The no-network requirement is checked on the built `map.html`, which may reference only package files, and enforced by the existing `connect-src` policy.
- **[The spec names sigma.js.]** → Section 11 of `RESEARCH_GRAPH_EXTENSION_SPEC.md` is amended in this change, with the reason.

## Migration Plan

No data migration. New dependencies are added to `package.json` and the lockfile. Rolling back removes the page, the messages and the popup button; stored data is untouched.
