# Design

## Context

- **The background already sees every move between nodes.** `tabCapture/model/trackActiveDwell` runs after every event that may move focus. When the focused node differs from the current visit's node, it starts a new visit. That moment, "focus moved from X to Y", is the input of both rules.
  - **Window blur and idle** pause a visit (`since: null`) without ending it, so they are not moves.
  - **Going back in the same tab** records a new node for the search page, and `handleNavigationCommitted` calls `followFocus` right after. So the move "result page → new search node" arrives through the same path as a tab switch.
- **The visit is persisted on the session** (`StoredSession.focus`), written through `researchSession/setSessionFocus`.
- **Edge recording** (`recordEdge`) is idempotent by `from|to|kind`. `EdgeKind` already includes `coAttention`. The target spec's `cluster_config@1` gives co-attention a weight of 0.8.
- **Engagement rules** live in `shared/config/engagementRules` (`engagement_rules@1`), and are applied by `researchGraph/getNodeEngagement`.
- **Map layout.** `buildMapLayout` feeds every edge to dagre, so each one ranks its target below its source.

## Goals / Non-Goals

**Goals:**

- Both rules in the existing focus step, with nothing held only in memory.
- A rule-set version that changes with the rules.

**Non-Goals:**

- **Co-attention across sessions, or with closed tabs reopened later.** Only nodes of the active session count.
- **A `return` edge kind.** The quick return is a signal on the page, not a relation, because nothing downstream reads a return edge yet.
- **Weighting co-attention by how often pages are compared.** The edge is recorded once, at 0.8.

## Decisions

### The recent moves live on the session record

`StoredSession.recentSwitches?: { from: string; to: string; at: number }[]` is written together with the visit, by `setSessionFocus(database, sessionId, { focus, recentSwitches })`.

On every move, the list is pruned to the last 5 minutes and capped at 50 entries. 50 moves in 5 minutes is far beyond comparing, and the cap keeps the record small.

It is optional and absent for a new session, so no migration is needed for it.

### Co-attention is counted on the unordered pair

`trackActiveDwell/utils/linkCoAttention({ database, sessionId, switches, now })` runs after each move:

1. It counts the moves within the window whose `{from, to}` equals the new move's pair, in either order.
2. At 3 or more, it records `coAttention` between the two nodes, with weight 0.8 (`CAPTURE_EDGE_WEIGHTS.coAttention`).
3. The edge runs from the lexicographically smaller id to the larger, so the pair has a single key whichever way it was flipped, and `recordEdge` keeps it single.

"A → C → B → A → B → A" holds three moves between A and B (B → A, A → B, B → A), which links them; A → C and C → B do not count for the pair. Counting moves rather than visits keeps the rule simple, and matches "focus alternates".

### A quick return is a signal, counted when the first visit ends

`trackActiveDwell/utils/countQuickReturn({ database, left, visit, target })` runs on a move from `left` (the ended visit's node) to `target`. It adds `quickReturnCount: 1` to `left` when all of these hold:

- `target.kind === "serp"`;
- `left.kind === "page"`;
- `!visit.isRevisit`;
- `visit.visitDwellMs < ENGAGEMENT_RULES.quickReturnMs` (10 s);
- `left`'s parent or opener node is a SERP.

"Within 10 s" is measured in active dwell, not wall time. Time spent in another application does not count against the page, and the visit already carries the number.

**Rejected alternative:** a `return` edge. Rules that read it would have to scan edges, whereas a signal is read where engagement is derived.

`StoredNodeSignals.quickReturnCount: number` becomes required. **Database version 9** rewrites every node's signals with `quickReturnCount: 0` when it is missing, as step 6 did for sessions. `mergeNodeSignals` adds it up like the other counts.

### `engagement_rules@2`

- The version is raised: the dead-end rule changes, and every node's derived state may change with it.
- The config gains `quickReturnMs: 10_000` and the co-attention values (`coAttentionMoves: 3`, `coAttentionWindowMs: 300_000`).
- `getNodeEngagement` checks the rules in this order:
  1. `unread`;
  2. `deep_read`;
  3. `dead_end`: when `quickReturnCount > 0`, or when the page is not focused, with dwell under 8 s and scroll under 15%;
  4. `skimmed`.

A quick return makes a page a dead end even while it is still focused: the user has already moved on once.

### The map draws co-attention laterally

- `buildMapLayout` leaves `coAttention` edges out of the dagre graph, so they rank nothing, and still draws them.
- **Style:** no `markerEnd`, `strokeDasharray: "1 3 6 3"`, class `edge-coAttention`.
- The e2e map reader learns the kind.

## Risks / Trade-offs

- **[Tab switching for other reasons]** Checking a timer or a chat tab three times, for example, is not comparing. Such tabs are mostly outside the session group, and moves count only between session nodes. Inside the group, a false co-attention edge costs a slightly bigger cluster in M2.
- **[A quick return measured in active dwell, not wall time]** A user who reads a page while its window is unfocused, which is rare, could exceed 10 s of wall time and still count. That is accepted.
- **[Migration rewrites every node]** A node count in the hundreds is rewritten in the version-change transaction, as step 6 did for sessions.

## Migration Plan

- **Version 9:** each node gets `signals.quickReturnCount = 0`.
- **No rollback,** as for every migration.

## Findings

- **The e2e harness compares pages too.** `selectTabShowing`, `clickInTabShowing` and the database reader find a tab by switching WebDriver windows, and each switch selects that tab. So the harness itself flips focus between session tabs, and `researchMap.e2e` grew co-attention edges between A–C and B–C that its exact edge list did not expect. The feature is right: those were real moves. Specs about other edges (`researchMap`, `searchCapture`, `sessionCapture`) now ignore `coAttention` through a local `withoutCoAttention`. The co-attention behaviour itself is asserted in `coAttention.e2e.ts`.
