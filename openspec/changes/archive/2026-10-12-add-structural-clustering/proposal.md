# Proposal

## Why

A session of a few dozen pages becomes a long tree in the popup. The user's research has threads, such
as "mid-drive motors" versus "battery range", and the tree shows only who opened whom. Clusters are
what M2 builds on: summaries, comparison tables and pruning all work per cluster.

REQ-CLU-001 requires clustering to work with no model installed, from structural and behavioural edges
alone. Every one of those is now recorded, each with its `cluster_config@1` weight:

- opener: 1.0;
- co-attention: 0.8;
- same-tab: 0.5;
- refinement: 0.3.

So clustering can start without waiting for embeddings.

## What Changes

- **Clustering the session.** The background clusters the active session's graph with Louvain
  (graphology), weighted by each edge's stored weight, with a fixed seed so the same graph gives the
  same clusters.
  - Dead-end pages are left out of detection, and join the cluster of the page they were reached from.
  - A page with no recorded relation forms a cluster of its own.
- **Stable identity.** Each new community takes the id of the previous cluster it overlaps most, by
  greedy best overlap, so a cluster keeps its identity as pages join it. graphology's Louvain cannot
  warm-start from a previous partition; fixed seeding plus identity matching is how stability is
  approached here, and the replay stability test (REQ-CLU-005) comes later.
- **Recompute.** Clustering reruns 5 s after the last graph change (debounced), and at reconciliation.
  It records `algorithm_version` (`louvain@1`) and `config_version` (`cluster_config@1`) (REQ-CLU-006).
- **Each cluster's label** is derived as the query of its earliest search, or else the title of its
  earliest page.
- **Storage.** One clustering record per session, replaced whole on each run (database version 10).
- **The graph snapshot** carries the clusters, each with its id, label and member ids.
- **The popup's tree** groups pages by cluster once a session has more than one cluster. Each cluster
  is a top-level row named by its label, holding its pages as before. Singleton pages that are not
  dead ends are gathered under one "Unclustered" row.

## Capabilities

### New Capabilities

- `research-clusters`: how a session's pages are grouped into clusters — inputs, dead ends,
  determinism, identity across recomputes, recompute timing, versioning and storage.

### Modified Capabilities

- `research-tree`: the tree groups pages by cluster.

## Impact

- **Dependencies:** `graphology` and `graphology-communities-louvain` (MIT), bundled into the
  background only; `graphology-types` for development.
- **New code:** `features/researchClusters/` (`clusterSession`, `matchClusterIdentity`, helpers, and
  the stored record's read and write).
- **Changed code:**
  - `app/backgroundApp`: a debounced recompute after capture writes, and a push;
  - `researchMap`'s snapshot gains `clusters`;
  - `researchTree`: `buildResearchTree` takes clusters, and the tree draws cluster rows.
- **Storage:** database version 10 adds a `clusterings` store keyed by session id.
- **Out of scope:**
  - semantic edges (REQ-CLU-002), which come after embeddings;
  - user corrections (REQ-CLU-004): there is nothing to correct with yet;
  - the replay stability test (REQ-CLU-005);
  - cluster bubbles on the map;
  - "Prune dead ends", a destructive action under UI-003.
