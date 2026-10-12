# Tasks

## 1. Rules and storage

- [x] 1.1 Change `engagementRules` to `engagement_rules@2`, with `quickReturnMs`, `coAttentionMoves` and `coAttentionWindowMs`. Add `coAttention: 0.8` to `CAPTURE_EDGE_WEIGHTS`.
- [x] 1.2 Add `quickReturnCount` to `StoredNodeSignals`, and `recentSwitches` to `StoredSession`. Raise `DATABASE_VERSION` to 9, with a step that gives every node `quickReturnCount: 0`. Extend the migration spec with a version-8 node gaining the field and keeping the rest.
- [x] 1.3 Make `mergeNodeSignals` add `quickReturnCount`, and extend its spec. Update every node fixture that spells out `signals`. Verify that `npm run typecheck` passes.
- [x] 1.4 Make `getNodeEngagement` apply `engagement_rules@2`. Its spec covers:
  - a quick return making a focused page a dead end;
  - a quick return not overriding a deep read.

## 2. Focus moves

- [x] 2.1 `setSessionFocus` takes `{ focus, recentSwitches }`. Update its spec and its callers.
- [x] 2.2 Add `trackActiveDwell/utils/linkCoAttention` and `utils/countQuickReturn`, and call both from `trackActiveDwell` on every move. The specs cover:
  - three moves within 5 minutes link the pair, and two do not;
  - moves 6 minutes apart do not link;
  - the edge is recorded once, in sorted-id direction;
  - a third tab in between counts only the pair's moves;
  - blur and idle are not moves;
  - a quick return is counted for a page from a SERP;
  - none after 10 s;
  - none on a revisit;
  - none for a page not from a SERP;
  - going back in the same tab counts.
- [x] 2.3 In `app/backgroundApp/index.spec.ts`, check that three tab switches between two session pages push a map snapshot with the `coAttention` edge.

## 3. Map

- [x] 3.1 `buildMapLayout` leaves `coAttention` out of dagre, and draws it without an arrow and with its own dash. Its spec checks that the layout positions are unchanged by the edge, and that the style differs from the other kinds.
- [x] 3.2 The e2e map reader recognises `edge-coAttention`. Update its spec.

## 4. End-to-end and documentation

- [x] 4.1 Add a `coAttention` case to an e2e spec: two session pages in two tabs, three switches between them, and then a `coAttention` edge in the database and on the map.
- [x] 4.2 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`:
  - REQ-CAP-007 is done, with the counting rule;
  - the engagement table becomes `engagement_rules@2`;
  - the return-to-SERP note is replaced.
- [x] 4.3 Run `npm run verify` and confirm that it passes.
