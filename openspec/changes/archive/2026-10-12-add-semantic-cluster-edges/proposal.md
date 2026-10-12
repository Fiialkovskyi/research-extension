# Proposal

## Why

Clusters are built only from how the user moved between pages. Two articles on the same subject,
each opened from nowhere — a typed address, a bookmark — and never compared side by side, are related
by nothing the graph records, and each stands alone. REQ-CLU-002
adds the missing signal: semantic edges between pages whose content is similar. Deep-read pages now
have vectors in the session's embedding space (`add-snapshot-embeddings`), so the edges can be computed
locally.

## What Changes

- **A page vector per node.** The node's vector is the normalised mean of its chunk vectors in the
  session's active embedding space.
- **Semantic edges.** Two pages whose vectors have cosine similarity of at least τ = 0.55 get an edge of
  weight `1.2 × (sim − τ) / (1 − τ)` (`cluster_config@1`). It is added to any recorded relation between
  the same two pages.
- **Space guard.** Only vectors of the session's active space are used, compared through the existing
  space guard. Pages without a vector in that space contribute no semantic edge (REQ-CLU-002), and
  neither do dead ends, which stay out of detection.
- **Provenance.** A clustering that used semantic edges records the embedding space it used
  (REQ-CLU-006).
- **Recompute.** Clustering reruns, debounced, after embedding jobs finish, so new vectors reach the
  clusters without waiting for the next page.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `research-clusters`:
  - semantic edges join pages by content;
  - recompute also follows new vectors;
  - provenance names the embedding space.

## Impact

- **Code:**
  - `researchClusters/clusterSession` takes optional page vectors and builds semantic edges, through a
    helper;
  - `reclusterActiveSession` reads the session's vectors;
  - `app/backgroundApp` schedules a recompute after jobs.
- **Storage:** `StoredClustering.embeddingSpaceId?`. It is optional, so there is no migration.
- **Performance:** at 300 pages, pairwise similarity is 45,000 dot products of a few hundred
  dimensions, a few tens of milliseconds, inside REQ-CLU-003's 200 ms. A test guards it.
- **Out of scope:**
  - top-k pruning of neighbours;
  - the derived same-domain and same-burst edges;
  - reporting a space mismatch to the diagnostics log. A mismatch cannot arise here, because every
    vector is read from the session's one space.
