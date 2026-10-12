# Design

## Context

- **The stream exists.** `graph.subscribe` over a port answers with a `graph.snapshot` and pushes a new one after every change, coalesced on the capture queue. The map consumes it (`app/mapApp`, `entrypoints/map`). The background drops a port's subscription when the port disconnects, which happens when the popup closes.
- **What a snapshot node carries:** `kind`, `query`, `title`, `domain`, `tabId`, `tabState`, `engagement`, `parentNodeId`, `openerNodeId`, `createdAt`, and now `copyEvents` (task 1.2).
- **The popup today** (`app/popupApp`) talks over one-shot messages through `PopupClient.request`. It shows the session's title and page count, "Open map", and the page-access notice.
- **Selecting a page's tab** is the `tab.focus` RPC, which refuses anything but an open node of the active session.
- **The e2e popup reader** (`firefoxToolbar/buildPopupReaderScript`) evaluates a script inside the popup document through the Marionette actor, and returns JSON. `clickPopupButton(testId)` clicks by test id.

## Goals / Non-Goals

**Goals:**

- Tree building, the queue and keyboard movement as pure functions with unit tests. The components only render and dispatch.
- No new protocol: the map's stream, plus one field.
- The popup's existing behaviour unchanged above the tree.

**Non-Goals:**

- **A sidebar.** It is replaced by this; see the proposal.
- **Virtualisation.** A few hundred rows render well within UI-001's 300 ms.
- **Clusters, pruning, renaming, destructive actions (UI-003), `graph.patch`.**

## Decisions

### `features/researchTree`

- **`model/buildResearchTree(nodes) → TreeRow[]`.** It returns a forest of `{ node, children }`.
  - A node's tree parent is `parentNodeId ?? openerNodeId`, when that node is in the snapshot. Otherwise the node is a root.
  - Siblings sort by `createdAt`, then by `id`.
  - A guard against a node met twice treats it as a root.
- **`model/listVisibleRows(forest, collapsed) → VisibleRow[]`.** Depth-first, skipping the children of collapsed rows. Each row has `{ node, level, positionInSet, setSize, parentId, hasChildren }`.
- **`model/moveTreeFocus(rows, focusedId, key, collapsed) → { focusedId, collapsed }`.** The WAI-ARIA tree keys:
  - Down and Up;
  - Right expands, or moves to the first child;
  - Left collapses, or moves to the parent;
  - Home and End.

  It is pure.

- **`model/listUnreadPages(nodes)`.** Open nodes whose engagement is `unread`, sorted by `createdAt`.
- **`ui/researchTree`.** It renders `role="tree"` with an accessible name. Each row is `role="treeitem"` with:
  - `aria-level`, `aria-posinset` and `aria-setsize`;
  - `aria-expanded` when it has children;
  - `aria-selected` on the focused row.

  It uses a roving `tabIndex`.

  A row shows:
  - the marker and the words from `ENGAGEMENT_DISPLAY`;
  - the title, or `search · <query>`;
  - `closed` when its tab is closed;
  - `✂` inside a span with `aria-label="copied from"` when `copyEvents > 0`.

  Rows indent by level. Enter, or a click on an open row, calls `onFocusTab(tabId)`.

- **`ui/unreadQueue`.** A heading with the count, and a list of buttons (`data-testid="unread-page"`).

The engagement words and markers move from `researchMap/ui/mapPageNode` to `shared/config` (`ENGAGEMENT_DISPLAY`, done in task 1.1), so the map and the popup cannot drift apart.

### The popup gains a graph stream beside its one-shot client

- **Props.** `PopupApp` takes a new `graph: GraphStream { send, subscribe }`, the shape `MapClient` has.
- **Subscribing.** While the state is `active`, it subscribes and sends `graph.subscribe`, keeping the latest snapshot.
- **Selecting a tab.** `tab.focus` goes over the same stream, and its answer arrives there.
- **The entrypoint.** It opens `browser.runtime.connect()` once and passes it as `graph`.
- **The one-shot client** stays for everything else, so none of the existing popup flows change.
- **State kept across snapshots.** `collapsed: Set<string>` and `focusedId` live in the popup's state. A new snapshot rebuilds the forest and leaves both alone. A focused id that no longer exists falls back to the first row. Rows start expanded. Nothing persists past the popup's close: it is gone in a moment anyway.
- **Layout.** The tree area gets `max-h-[24rem] overflow-y-auto`, so the popup does not grow past Firefox's popup limit (about 600 px).

### The snapshot gains `copyEvents`

`mapNodeSchema.copyEvents: number`, copied by `buildGraphSnapshot`. The map ignores it.

### End-to-end

- **The popup reader** also returns:
  - `treeRows`: text, `aria-level`, `aria-expanded`, `data-engagement` and `data-tab-state` per `treeitem`;
  - `unreadCount`;
  - `unreadPages`: the queue's texts.
- **A spec builds a session:**
  1. a search;
  2. a result opened in a new tab from it;
  3. a link followed in that tab;
  4. a page opened in the background.

  It then checks the nesting and levels, and the unread queue. It activates the queue's first entry, and checks that the tab is selected and that the next popup no longer lists it.

- **Keyboard behaviour** is covered by unit tests. Sending keys into a popup through the actor would test Firefox, not us.

## Risks / Trade-offs

- **[The popup is small]** → The tree scrolls inside it. Deep same-tab chains indent; a 12 px indent per level keeps ten levels readable at the popup's width.
- **[The popup closes when a tab is selected]** → That is the intended effect of "return to a page". The popup's collapsed state is lost with it, which is acceptable for a transient surface.
- **[The target spec's sidebar]** → `RESEARCH_GRAPH_EXTENSION_SPEC.md`'s UI table and M1 line are updated to say the tree lives in the popup.

## Migration Plan

No data changes.
