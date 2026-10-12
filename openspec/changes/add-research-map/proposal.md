# Proposal

## Why

Capture fills the graph, but the only thing the user can see of it is a page count in the popup. Whether a node got the right parent, whether an opener was linked and whether a closed tab is marked closed can be checked today only by e2e tests or DevTools. Before SERP detection, dwell and embeddings build on this graph, the user needs to look at it. This change adds the first version of the target spec's Research map (§11): a page that draws the active session's graph and stays current while the user browses.

## What Changes

- **A map page** `map.html`, opened in a tab of its own. It draws the active session's nodes and edges as a top-down graph:
  - each node shows its title and domain, and a closed node is dimmed and labelled `closed`, so the state is never carried by colour alone;
  - a `sameTab` edge is drawn solid and an `opener` edge dashed;
  - pan, zoom and fit-to-view;
  - light and dark appearance follow the system;
  - with no active session the page says so.
- **Live updates.** The page subscribes to the background over a port. It gets a snapshot of the graph at once and a fresh one after every change to the session or its graph.
- **Click to focus.** Activating an open node, by mouse or keyboard, selects its tab and focuses that tab's window. A closed node does nothing.
- **The popup** gains an `Open map` button while a session is active. It focuses the map tab when one is already open and opens one otherwise. The map tab is never placed in the session's group.
- **New dependencies:** `@xyflow/react` (React Flow, MIT) to render the graph and `@dagrejs/dagre` (MIT) to lay it out. Both are bundled and make no network calls.

## Capabilities

### New Capabilities

- `research-map`: the map page — what it shows of the active session's graph, how it stays current, what activating a node does, and how the popup opens it.

### Modified Capabilities

None. The popup's existing requirement ("shows the active session") stays as it is; the button is specified in `research-map`.

## Impact

- **New code:**
  - `src/features/researchMap/`:
    - model: the snapshot message schemas, `buildGraphSnapshot`, `buildMapLayout`;
    - ui: `ResearchMap` and its node component. The barrel does not export the UI, so the background never bundles React Flow.
  - `src/app/mapApp/`, `src/entrypoints/map/`.
- **Modified code:**
  - `src/app/backgroundApp`:
    - `graph.subscribe` over a port, with snapshots pushed to subscribers after changes;
    - `tab.focus`;
    - `map.open`;
    - port disconnect handling.
  - `src/entrypoints/background`: real implementations of focusing a tab and finding or opening the map tab.
  - `src/app/popupApp`: the `Open map` button.
  - e2e: a map fixture and a map scenario.
  - `RESEARCH_GRAPH_EXTENSION_SPEC.md` §11: the map's library.
- **Bundle:** the map page grows by roughly 90 KB gzipped. The target spec exempts the map's graph library from the 300 KB per-page budget (REQ-UI-007). The background and popup bundles must not grow by it.
- **Permissions:** none added.
- **Out of scope:**
  - incremental `graph.patch` messages and virtualisation;
  - clusters and a radial layout;
  - highlighting the currently active tab;
  - the sidebar tree;
  - showing saved sessions;
  - deleting or pruning nodes;
  - signals (dwell, scroll) on the node.
