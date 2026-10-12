# Design

## Context

- **Edges carry weights.** Capture records `opener` (1.0), `sameTab` (0.5), `refinement` (0.3) and `coAttention` (0.8) with their `cluster_config@1` weights on `StoredEdge.weight`.
- **Reading the graph.** `readSessionGraph` returns a session's nodes and edges, and `getNodeEngagement` derives `dead_end`.
- **Background shape.**
  - Capture writes go through `captureAndPush` on one serial queue.
  - The map and the popup tree receive `graph.snapshot`, built by `researchMap/buildGraphSnapshot`.
  - The event page can unload at any time, so in-memory timers are best-effort.
- **graphology's Louvain** (`graphology-communities-louvain@2`) accepts `getEdgeWeight`, `resolution` and `rng`, and has no initial-partition option.
- **The popup tree** (`researchTree`) builds a forest from snapshot nodes and draws it with WAI-ARIA tree semantics. `moveTreeFocus` and `listVisibleRows` work on any forest of `{ node, children }`.

## Goals / Non-Goals

**Goals:**

- Deterministic clusters from recorded relations, with no model.
- Cluster ids that survive recompute while a thread grows.
- No user-visible lag: recompute is debounced, and off the path of capture writes.

**Non-Goals:**

- **Semantic edges** (REQ-CLU-002).
- **Same-domain and burst edges** from the weight table. They are derived, not recorded, and would double the inputs this change has to justify. They are a follow-up.
- **User corrections** (REQ-CLU-004).
- **The replay stability test** (REQ-CLU-005).
- **Hysteresis beyond identity matching.**
- **Map cluster bubbles.**

## Decisions

### `features/researchClusters`

- **`model/clusterSession({ nodes, edges, previous }) → Clustering`.** It is pure, which makes it unit-testable and fast.
  1. It derives each node's engagement as left (`isFocused: false`), and splits nodes into `members` (not dead end) and `deadEnds`.
  2. It builds an undirected graphology `Graph` over `members`. For each edge between two members it adds the weight, merging parallel edges by summing.
  3. It runs `louvain(graph, { getEdgeWeight: "weight", rng: buildSeededRandom(CLUSTER_SEED) })`. The PRNG is mulberry32, and nodes are added in `createdAt`/`id` order, so the result depends only on the graph.
  4. Isolated members, those with no edges, become singleton communities. Louvain already does this.
  5. It attaches dead ends by walking `parentNodeId ?? openerNodeId` up to the first node that has a community, and makes a dead end its own community when there is none.
  6. It matches identities with `matchClusterIdentity`.
  7. It derives each label: the earliest SERP's query, or else the earliest node's title, or else its URL.
- **`model/clusterSession/utils/matchClusterIdentity(newGroups, previousClusters)`.**
  - It scores every (new, previous) pair by shared members.
  - It assigns greedily, from the highest overlap down, each id at most once, with ties broken by the smaller previous id and then by the new group's first member.
  - Groups left unmatched get `crypto.randomUUID()`.
- **`model/readClustering(database, sessionId)` and `model/storeClustering(database, clustering)`.** The record:

  ```ts
  StoredClustering {
    sessionId: string;                       // key
    algorithmVersion: "louvain@1";
    configVersion: "cluster_config@1";
    computedAt: number;
    clusters: { id: string; label: string; memberIds: string[] }[];
  }
  ```

  One record per session, replaced whole, so readers never see half a recompute.

- **The constants:**
  - `CLUSTER_ALGORITHM_VERSION`;
  - `CLUSTER_CONFIG_VERSION`;
  - `CLUSTER_SEED`;
  - `RECLUSTER_DELAY_MS = 5_000`.

  They live in `researchClusters/constants.ts`. The edge weights stay where capture records them.

### Recompute is debounced in the background, on the capture queue

- **Scheduling.** `app/backgroundApp` keeps one timer. `captureAndPush` (re)arms it for 5 s whenever a capture write is queued. When it fires, it enqueues `reclusterActiveSession`, which:
  1. reads the session graph and the previous clustering;
  2. runs `clusterSession`;
  3. stores the result;
  4. pushes the graph.
- **Start-up.** `reconcileSession` runs one recompute without waiting.
- **If the event page unloads before the timer fires,** the next capture event re-arms it, and start-up reconciliation covers a restart. This is accepted: no recompute is owed while nothing changes.
- **Rejected alternative: `alarms`.** They need a permission and have a 30 s minimum in Firefox for unpacked builds. That is too coarse for a 5 s debounce, and only a fallback would need it.

### The snapshot carries clusters, and the tree groups by them

- **Snapshot.** `graphSnapshotSchema` gains `clusters: { id, label, memberIds }[]`, empty before the first clustering. `readGraphSnapshot` reads the session's clustering beside its graph.
- **Tree.** `buildResearchTree(nodes, clusters = [])`:
  - With fewer than two clusters, the tree is as today.
  - Otherwise, a cluster with two or more members becomes a top-level row, `{ kind: "cluster", id, label, size, children }`. Its children are the forest of its own members, with parent links outside the cluster ignored.
  - Members of singleton clusters are pooled under one `Unclustered` row.
  - Cluster rows are ordered by their earliest member's `createdAt`, and `Unclustered` comes last.
- **Row types.** `TreeRow` becomes a union of a page row (`{ kind: "page", node, children }`) and a cluster row. `listVisibleRows` and `moveTreeFocus` work by row id. A cluster row's id is `cluster:<id>`, and the `Unclustered` row's id is `cluster:unclustered`.
- **Drawing.** `ResearchTree` draws a cluster row as `<label> · <n>`, with `data-row-kind="cluster"`, and does not activate it.

### Performance

At 300 nodes and about 600 edges, graph construction plus Louvain plus matching runs in a few milliseconds in Node. A unit test builds such a synthetic session and asserts the median of 10 runs is under 200 ms, a guard far above the expected cost.

## Risks / Trade-offs

- **[Louvain on sparse capture graphs makes many small clusters]** → Singletons pool under `Unclustered`, and the tree groups only when there are at least two clusters. Semantic edges in a later change densify the graph.
- **[No warm start means clusters can reshuffle when the graph changes a lot]** → Identity matching keeps ids for stable threads. The stability test and hysteresis come with REQ-CLU-005.
- **[The popup tree changes shape when clustering arrives 5 s later]** → The tree keeps its collapsed and focused rows by id. A cluster row appearing is the expected change.
- **[Background bundle grows by graphology]** → About 60 kB minified. It is not imported by any surface.

## Migration Plan

- **Version 10:** add the `clusterings` store, keyed by `sessionId`. There are no rewrites.
