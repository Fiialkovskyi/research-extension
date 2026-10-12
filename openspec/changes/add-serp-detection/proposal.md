# Proposal

## Why

Research starts from a search, and the graph cannot tell yet. Every captured page is a plain `page` node, so a session has no root, and a refined search cannot be told from any other page. REQ-CAP-003 asks for SERP nodes with their query, a root and `refinement` edges, and clustering (M2) weights refinement edges on their own. The storage types already reserve `kind: "serp"`, `query` and the `refinement` edge kind, but nothing produces them.

It is also the cheapest next step that shows on the research map. A search, the results opened from it and a second, narrower search become a visible tree.

## What Changes

- **Search engine table.** A bundled table of URL patterns for Google, Bing, DuckDuckGo, Startpage, Ecosia, Kagi and Brave Search. It reads the query from URL parameters only, never from the page.
- **SERP nodes.** A captured page whose URL matches the table, with a non-blank query, is recorded with `kind: "serp"` and its `query`. This holds on every path that records a node: a committed navigation, a tab joining the group, a restored tab and start-up reconciliation.
- **Root and refinements.**
  - The session's first SERP is its root. The root is derived from the graph, so no field is stored.
  - A later SERP whose normalized query differs from the root's is linked from the root by a `refinement` edge, weight 0.3 (`cluster_config@1`).
  - A further page of results for the same query is a SERP node without a refinement edge.
- **Map.**
  - A SERP node shows its query and is labelled `search`, so the kind is not carried by colour alone.
  - Refinement edges are drawn in a third style.
  - The snapshot carries each node's `kind` and `query`.

Out of scope:

- **Engagement states and the content script (CAP-005, CAP-006, the engagement table).** Scroll depth and copy events need a content script, its host permission and dynamic registration (RT-002, RT-003). That is a change of its own.
- **Co-attention edges (CAP-007)** and **return-to-SERP dead ends.** The second needs engagement.
- **The domain denylist (CAP-008, SEC-007).** It comes with the options editor. Private windows and non-web pages are already excluded.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `research-graph`: pages that match a search engine pattern are recorded as SERP nodes with their query. The first SERP is the session's root, and later SERPs with a different query get a `refinement` edge from it.
- `research-map`: SERP nodes are drawn with their query and a `search` label, and refinement edges in a style of their own.

## Impact

- **New code:** `src/features/tabCapture/model/` gains query extraction and the root and refinement rule. The engine table goes in `src/shared/config`.
- **Changed recording paths:** `recordNavigation`, `followTabMembership` and `reconcileSessionTabs` go through one shared node builder, so every path classifies a page the same way.
- **Map:** `src/features/researchMap` gets schema fields, layout edge styles and the node component.
- **Database:** no schema change and no migration. `kind`, `query` and the `refinement` kind already exist.
- **Permissions:** none added.
- **End-to-end:** loading search URLs offline needs a test-profile setup that resolves search hosts to the local page server. See design.md.
