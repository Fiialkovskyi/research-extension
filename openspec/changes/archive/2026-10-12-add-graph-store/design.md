# Design

## Context

The database is at version 3 (`models`, `modelFiles`, `runs`, `sessions`). The target spec's `GraphNode` and `GraphEdge` (§4) and its store table (§9) describe the full graph. The code guide's storage rules (`docs/codeGuide/STORAGE.md`) add three constraints the spec does not: camelCase names, no derived values, and an index only together with the query that uses it.

## Goals / Non-Goals

**Goals:**

- Store a session's graph so it survives an event-page unload and a restart.
- Let capture write a node per page, accumulate its signals, and link nodes, without duplicates.
- Let a woken background find the node each tab is showing.

**Non-Goals:** capture itself, engagement rules, clustering, snapshots, graph streaming to surfaces, deletion.

## Decisions

### Records

```ts
type NodeKind = "serp" | "page";
type NodeTabState = "open" | "closed";
type EdgeKind = "opener" | "sameTab" | "refinement" | "coAttention" | "return" | "user";

interface StoredNodeSignals {
  activeDwellMs: number;
  maxScroll: number; // 0..1
  copyEvents: number;
  focusCount: number;
  revisitCount: number;
}

interface StoredNode {
  id: string; // UUID
  sessionId: string;
  tabId: number;
  kind: NodeKind;
  url: string;
  domain: string;
  title: string;
  query?: string; // SERP nodes only
  parentNodeId: string | null;
  openerNodeId: string | null;
  transitionType: string;
  signals: StoredNodeSignals;
  tabState: NodeTabState;
  createdAt: number;
  lastFocusedAt?: number;
}

interface StoredEdge {
  id: string; // `${from}|${to}|${kind}`
  sessionId: string;
  kind: EdgeKind;
  from: string;
  to: string;
  weight: number;
  createdAt: number;
}
```

Deviations from the target spec, each deliberate:

| Spec                                                                                         | Here                                    | Why                                                                                                                      |
| -------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `snake_case` fields and values (`deep_read`, `same_tab`)                                     | camelCase                               | Code guide naming.                                                                                                       |
| `engagement` stored, indexed with `session_id`                                               | not stored                              | Derived from signals by versioned rules; storing it would need a rewrite whenever the rules change. Computed where read. |
| `signals.children_count`                                                                     | not stored                              | Derived from `parentNodeId`.                                                                                             |
| `tab_state: "never_focused"`                                                                 | `"open" \| "closed"`                    | Never focused is `focusCount === 0`.                                                                                     |
| no `tabId`                                                                                   | `tabId` with index `[sessionId, tabId]` | A woken background must find the node a tab shows (REQ-RT-004).                                                          |
| edge index `[from+to+kind]`                                                                  | edge key `from\|to\|kind`               | The key makes a second write of one relation a no-op without a lookup.                                                   |
| `url_pattern`, `domain_category`, `cluster_id`, `content_hash`, `snapshot_id`, `user_pinned` | absent                                  | Added by the change that first uses each.                                                                                |

The session's `rootNodeId` is also left for capture, which is the first code that sets it (CAP-003); adding it here would be a field nothing writes.

### Finding a tab's node

Tab ids are not stable across a browser restart, so after one a new tab can reuse an old id. `readTabNode(sessionId, tabId)` therefore reads all nodes for `[sessionId, tabId]` and returns the newest one whose `tabState` is `open`. Closing nodes whose tabs did not come back after a restart is capture's job.

### Merging signals

`addNodeSignals(database, nodeId, observation)` reads and writes in one `readwrite` transaction, so two observations arriving together are both kept. Dwell, copy events, focus and revisit counts add; `maxScroll` and `lastFocusedAt` take the maximum. The merge itself is a pure helper (`mergeNodeSignals`) with its own tests. A missing node throws with its id, because an observation for a node that was never recorded is a capture bug.

### Edges

`recordEdge` computes the key, and in one transaction returns the stored edge if it exists, or writes the new one. First write wins: weights are the defaults of the edge kind (`cluster_config`), not accumulated.

### One read for the graph

`readSessionGraph(sessionId)` opens one read-only transaction over `nodes` and `edges` and reads both by the `sessionId` index, so a surface never sees nodes from one moment and edges from another.

## Risks / Trade-offs

- **No producer, so nothing exercises the store end to end yet.** → Unit tests on `fake-indexeddb`; capture follows immediately.
- **Engagement computed on read costs a pass over signals.** → A session holds hundreds of nodes; the rules are arithmetic.

## Migration Plan

Step 4 creates `nodes` (indexes `sessionId`, `sessionTab` on `["sessionId", "tabId"]`) and `edges` (index `sessionId`). No existing store changes.
