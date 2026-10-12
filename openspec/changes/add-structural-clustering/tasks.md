# Tasks

## 1. Storage and constants

- [x] 1.1 Add the dependencies `graphology` and `graphology-communities-louvain`, and the dev dependency `graphology-types`. Verify that `npm install` and `npm run typecheck` pass.
- [x] 1.2 Add `StoredClustering` and `CLUSTERING_STORE` (keyed by `sessionId`), and raise `DATABASE_VERSION` to 10, with a step that creates the store. Extend the migration and open specs.

## 2. Clustering model

- [x] 2.1 Add `researchClusters` with its constants, and with `utils/buildSeededRandom`, which has its own spec covering a deterministic sequence in [0, 1).
- [x] 2.2 Add `clusterSession/utils/matchClusterIdentity`. Its spec covers:
  - the previous id kept for the best overlap;
  - no id given twice;
  - ties;
  - a new id for no overlap.
- [x] 2.3 Add `model/clusterSession`. Its spec covers:
  - two threads split;
  - co-attention joining two pages;
  - a dead end joining its source's cluster;
  - a dead end with no clustered source standing alone;
  - an isolated page standing alone;
  - the same input giving the same output;
  - labels from a SERP query and from a title;
  - versions recorded;
  - identity kept as a page joins;
  - the median time for 300 nodes under 200 ms.
- [x] 2.4 Add `readClustering` and `storeClustering`, with fake-indexeddb specs, including whole replacement.

## 3. Background and snapshot

- [x] 3.1 Add `reclusterActiveSession(database)` in `researchClusters`, which reads, clusters and stores, and does nothing without a session. Add a spec.
- [x] 3.2 In `app/backgroundApp`:
  - a debounced recompute armed by capture writes, with an injectable delay and timer for tests;
  - a recompute at reconciliation;
  - a push after each recompute.

  The specs cover:
  - a burst giving one recompute;
  - the snapshot carrying clusters afterwards;
  - start-up recompute.

- [x] 3.3 Add `clusters` to `graphSnapshotSchema` and `buildGraphSnapshot`, and update their specs and fixtures.

## 4. Popup tree

- [x] 4.1 `buildResearchTree(nodes, clusters)` returns cluster rows per design.md, with `TreeRow` as a union. Its spec covers:
  - no grouping with fewer than two clusters;
  - grouping;
  - the `Unclustered` pool;
  - order;
  - parent links across clusters ignored.
- [x] 4.2 Make `listVisibleRows` and `moveTreeFocus` work by row id with cluster rows, and update their specs.
- [x] 4.3 `ResearchTree` draws cluster rows (`<label> · <n>`, `data-row-kind`, not activatable). Update the specs. The popup passes the snapshot's clusters.

## 5. End-to-end and documentation

- [x] 5.1 The popup reader also returns each row's kind. Extend `popupResearchTree.e2e.ts`: after two separate searches with results, the popup eventually shows two cluster rows holding their pages. Allow for the 5 s debounce in the wait. Verify that `npm run test:e2e` passes.
- [x] 5.2 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`:
  - REQ-CLU-001, 003 and 006 note the implementation;
  - the warm-start deviation (identity matching instead);
  - which edges are used so far.

  Verify that `openspec validate add-structural-clustering --strict` passes.

- [x] 5.3 Run `npm run verify` and confirm that it passes.
