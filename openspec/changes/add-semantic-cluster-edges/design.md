# Design

## Context

- **`clusterSession({ nodes, edges, previous, … })`** is pure. It builds an undirected graphology graph over the pages that are not dead ends, sums the edge weights per pair, and runs a seeded Louvain.
- **`reclusterActiveSession`** reads the graph and the previous clustering, then stores the result. It runs debounced after capture writes, and at start-up.
- **Vectors** are `StoredVector { spaceId, chunkId, part, nodeId, sessionId, vector }`, keyed `[spaceId, chunkId, part]`. A space's vectors are one key range. The session's space is `StoredSession.activeEmbeddingSpaceId`.
- **`snapshotEmbeddings/compareVectors`** gives the cosine of two vectors of the same space, and throws on different spaces.
- **The background job runner** (`runJobs`) loops over `runNextEmbeddingJob` until none is due.

## Goals / Non-Goals

**Goals:**

- `clusterSession` stays pure, with vectors as an optional input.
- The space guard is applied by construction, not by convention.

**Non-Goals:** top-k neighbour pruning, derived edges, and diagnostics-log reporting.

## Decisions

### Page vectors are computed in `reclusterActiveSession`

`model/readPageVectors(database, sessionId, spaceId) → Map<nodeId, Float32Array>`:

1. It reads the space's key range from `vectors`.
2. It keeps the session's vectors.
3. It averages them per node, then L2-normalises the mean.

It returns nothing for a session without a space. The cost is one range read, of a few hundred vectors per session.

### Semantic edges are built inside `clusterSession`

- **Input.** `clusterSession` gains `semantic?: { spaceId: string; vectors: ReadonlyMap<string, Float32Array> }`.
- **The helper.** `clusterSession/utils/buildSemanticEdges(memberIds, semantic)` takes the vectors of one space only, so mixing spaces is impossible by construction. It scales each vector to unit length once, so a pair's cosine is a plain dot product. It returns `{ from, to, weight }` for every pair of member pages that both have a vector, at a similarity ≥ τ.
- **Merging.** These edges are added to the graph exactly like recorded edges, summing with any relation the same pair already has.
- **Constants.** `SEMANTIC_THRESHOLD = 0.55` and `SEMANTIC_WEIGHT_SCALE = 1.2` live in `researchClusters/constants.ts`, from `cluster_config@1`.
- **Provenance.** The result carries `embeddingSpaceId` when `semantic` was given and at least one member had a vector.

Members are visited in `createdAt`/`id` order, so the pair order, and with it the graph, is deterministic.

### Recompute after jobs

`runJobs` in `app/backgroundApp` notes whether any job ran. When the loop ends with at least one, it calls `scheduleRecluster()`: the same 5 s debounce as capture writes.

### Storage

`StoredClustering.embeddingSpaceId?: string`, optional, with no migration.

## Risks / Trade-offs

- **[Meaning does not override strong structure]** → A semantic edge weighs at most 1.2, against 1.0 for an opener. Two threads, each a search with its results, joined only through one similar pair still split along the semantic edge, because cutting a path in the middle maximises modularity. That is intended: semantics joins what structure leaves apart (pages opened from nowhere, single results), and strengthens clusters, rather than rewriting them. The spec's scenarios say exactly this.
- **[Many weak semantic edges blur clusters on a homogeneous session]** → The threshold and the rescaling mean weak similarities add little weight. Top-k pruning is the follow-up if sessions show it.
- **[O(n²) similarity]** → About 45k comparisons at 300 pages. The 300-node performance test now includes vectors of 384 dimensions.
- **[Vectors arrive late on the slow provider]** → Clusters improve as vectors land, and the recompute after jobs makes that visible.

## Findings

- **Per-pair `compareVectors` was too slow at 300 pages.** Recomputing two norms per pair, over about 45,000 pairs, took the recompute over REQ-CLU-003's 200 ms under the full test suite's load. Unit vectors computed once, then dot products, fix it. `compareVectors` remains the guarded comparison for callers holding vectors of possibly different spaces.
- **jsdom slows typed-array arithmetic about fivefold.** The same pairwise loop takes about 20 ms under Node and about 106 ms under the unit runner's jsdom environment, and about 18 ms in plain Node outside vitest. The `clusterSession` spec, which is timed and needs no DOM, now runs in the `node` environment, so its budget measures the code rather than the test environment.

## Migration Plan

None.
