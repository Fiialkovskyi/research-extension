# Tasks

## 1. Model

- [x] 1.1 Add `SEMANTIC_THRESHOLD` and `SEMANTIC_WEIGHT_SCALE`, and `StoredClustering.embeddingSpaceId?`.
- [x] 1.2 Add `clusterSession/utils/buildSemanticEdges`. Its spec covers:
  - an edge at 0.9 with the expected weight;
  - none below 0.55;
  - pages without a vector skipped;
  - deterministic order.
- [x] 1.3 `clusterSession` takes `semantic`, merges the edges and records `embeddingSpaceId`. Its spec covers:
  - two unrelated threads joined by similar pages;
  - dead ends still kept out;
  - no space recorded without vectors;
  - the 300-page timing with 384-dimension vectors under 200 ms.

## 2. Reading vectors and recomputing

- [x] 2.1 Add `researchClusters/model/readPageVectors`. Its fake-indexeddb spec covers:
  - the mean of a node's parts, normalised;
  - another session's and another space's vectors ignored.
- [x] 2.2 `reclusterActiveSession` passes the session's page vectors when it has a space. Extend its spec.
- [x] 2.3 `app/backgroundApp` schedules a recompute after jobs ran. Extend its spec so that a finished embedding job leads to a clustering that records the space.

## 3. Documentation

- [x] 3.1 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`: the "implemented so far" note under clustering, and REQ-CLU-002. Verify that `openspec validate add-semantic-cluster-edges --strict` passes.
- [x] 3.2 Run `npm run verify` and confirm that it passes.
