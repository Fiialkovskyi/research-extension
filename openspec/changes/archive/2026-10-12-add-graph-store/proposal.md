# Proposal

## Why

The research graph (spec §4) is what the session records: one node per page visited in the session's tabs, and edges for how the user got from one to the next. The background is an event page that Firefox unloads at will, so the graph cannot live in memory (REQ-RT-004); it has to be in the database before capture can write to it. This change adds that storage and the functions capture and the UI will call. It is the second of the three MVP database changes: sessions (done, version 3), the graph (this change, version 4), and the job queue (version 5).

## What Changes

- **Two stores join the database in migration step 4:**
  - `nodes`: one record per page in a session, indexed by session and by `[sessionId, tabId]`;
  - `edges`: one record per relation between two nodes, keyed by `from|to|kind`, so the same relation is never stored twice.
- **A node keeps only observed facts:** where it is (URL, domain, title, SERP query), how it was reached (parent and opener node, transition type), whether its tab is open, and the raw engagement signals (active dwell, max scroll, copy events, focus and revisit counts, last focus time).
- **Derived values are not stored.** Engagement state is computed from signals by versioned rules, and child counts from parent links; both are computed where they are needed (code guide §6.7).
- **Functions in a new `researchGraph` feature:**
  - `recordNode` creates a node with zeroed signals;
  - `addNodeSignals` merges new observations into a node's signals in one transaction (sums for dwell and counters, maximum for scroll and last focus);
  - `closeNode` marks a node's tab closed and keeps its history;
  - `recordEdge` stores a relation once, whatever the number of writes;
  - `readTabNode` finds the node a tab currently shows, so a woken background can continue where it was;
  - `readSessionGraph` reads a session's nodes and edges in one transaction.

## Capabilities

### New Capabilities

- `research-graph`: how a session's graph is stored: nodes and their signals, edges, and what is kept when a tab closes.

### Modified Capabilities

None.

## Impact

- **Modified:** `src/shared/storage` (`NODE_STORE`, `EDGE_STORE`, `StoredNode`, `StoredEdge`, step 4, `DATABASE_VERSION = 4`).
- **New:** `src/features/researchGraph/`.
- **No producer yet.** Capture (CAP-001, CAP-002, CAP-004) writes nodes in its own change; it needs `tabs` or host permissions for URLs and titles, which this change does not add.
- **Out of scope:** capture, engagement rules, clustering fields (`clusterId`), snapshots (`contentHash`, `snapshotId`), `urlPattern`, `domainCategory`, `userPinned`, the session's `rootNodeId`, graph RPC (`graph.subscribe`/`graph.patch`), and deletion cascades. Each arrives with the code that first uses it.
