# Tasks

## 1. Storage

- [x] 1.1 Add `NODE_STORE`, `EDGE_STORE`, `StoredNode`, `StoredNodeSignals`, `StoredEdge` and their kinds to `src/shared/storage`; raise `DATABASE_VERSION` to 4 and add step 4 creating both stores and their indexes. Extend the upgrade spec: the stores and indexes exist, and a version-3 profile keeps its sessions.

## 2. Graph model

- [x] 2.1 Add `src/features/researchGraph/` with its barrel and types.
- [x] 2.2 `recordNode` and `closeNode`, with specs.
- [x] 2.3 `mergeNodeSignals` (pure) and `addNodeSignals`, with specs: sums, maxima, two concurrent observations both kept, a missing node named in the error.
- [x] 2.4 `recordEdge` with a spec: a second write of the same relation is a no-op.
- [x] 2.5 `readTabNode` with a spec: newest open node wins; a closed node is never returned; other sessions are ignored.
- [x] 2.6 `readSessionGraph` with a spec: only the session's nodes and edges.

## 3. Verification

- [x] 3.1 Update `docs/codeGuide/STORAGE.md` store list; run `npm run verify` and `openspec validate add-graph-store`.
