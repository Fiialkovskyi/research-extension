# Tasks

## 1. Storage

- [x] 1.1 Add `StoredRejection` and the `rejections` store with a `sessionId` index (migration 18), and add it to `deleteSession`. Verify with the migration and `deleteSession` specs.

## 2. Rejections feature

- [x] 2.1 Create `features/factRejections` with `getFactKey` (design decision 1). Verify with specs: grams and kilograms give one key, case and punctuation give one key, values within 5% give two keys, and text values work.
- [x] 2.2 Add `rejectFacts`, `restoreRejections`, `readRejectedKeys` and `filterRejectedFacts`. Verify with specs for rejecting by fact ids, one rejection per key, restoring the session's rejections, and filtering.

## 3. Synthesis views

- [x] 3.1 Filter rejected facts in `readComparisonTable`, and report `rejectedCount`. Verify with its spec: a rejected minority value removes the conflict.
- [x] 3.2 Give `readClusterFactIds` the data key and filter rejected facts; update its callers. Drop rejected citations in `readSummariesView`. Verify with specs: the fact set changes after a rejection, the summary turns stale, and the citation is gone.

## 4. Background and page

- [x] 4.1 Add `facts.reject` and `facts.restoreRejections` to `app/backgroundApp`, queueing summaries after either. Verify with background specs.
- [x] 4.2 Add "Wrong" to table values and summary citations, and the rejected count with "Restore all", re-reading after each. Verify with component and app specs. Extend `summaries.e2e.ts`: no rejection count before any rejection.

## 5. Documentation and verification

- [x] 5.1 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`: tick "Rejections", and record the key and the filtering. Verify that `openspec validate add-rejections --strict` passes.
- [x] 5.2 Run `npm run verify` and confirm that it passes.
