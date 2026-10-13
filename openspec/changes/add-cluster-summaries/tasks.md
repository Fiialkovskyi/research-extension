# Tasks

## 1. Storage and queue

- [x] 1.1 Add `StoredSummary` and the `summaries` store with a `sessionId` index (migration 16). Verify with the migration spec.
- [x] 1.2 Give `enqueueJob` an optional `notBefore`. Verify with its spec: the job is not claimable before then, and re-enqueueing a failed job honours it.

## 2. Summary feature (pure parts)

- [x] 2.1 Create `features/clusterSummaries` with:
  - `prompts/clusterSummary@1.md` and its schema;
  - the valibot mirror;
  - constants;
  - the guard `constants.spec.ts`.

  Verify that the guard passes.

- [x] 2.2 Add `selectSummaryFacts` (design decision 3). Verify with specs for:
  - fewer than the cap;
  - round-robin across entities;
  - pages before repeats;
  - the omitted count.
- [x] 2.3 Add `buildSummaryMessages` (design decision 1). Verify with specs for the layout, the labels and escaping.
- [x] 2.4 Add `readSummaryAnswer` with citation mapping (design decision 2). Verify with specs for:
  - valid citations;
  - an unknown label dropped;
  - a statement left uncited discarded;
  - more than 8 statements refused;
  - non-JSON.
- [x] 2.5 Add `getFactSetHash` and `isSummaryStale`. Verify with specs: order does not matter, and staleness follows a changed set or a removed model.

## 3. The job

- [x] 3.1 Add `enqueueClusterSummaries` (design decision 4). Verify with specs for:
  - a job per cluster with facts, 60 s ahead;
  - none for a cluster without facts;
  - none when the stored summary is current;
  - none without a generation model;
  - a new job after the set changes.
- [x] 3.2 Add `runClusterSummaryJob`. It skips a superseded set, selects, builds, generates, maps, encrypts and stores, and records a content-free run. Verify with specs for:
  - a stored summary, encrypted;
  - a superseded job doing nothing;
  - an invalid answer failing;
  - the omitted count.

## 4. Background

- [x] 4.1 Wire the feature into `app/backgroundApp`:
  - the runner, held, in the generation gate;
  - enqueueing after resolution, recluster and page deletion;
  - `summaries.read`, `summaries.refresh` and `summaries.open`;
  - the `openSummariesPage` dependency and the entrypoint's implementation;
  - `deleteSession` covering summaries.

  Verify with background specs against the fake Ollama:
  - a summary generated while idle, after the delay;
  - none while active;
  - refresh running while active;
  - staleness once the cluster's facts change (page deletion changes the fact set the same way, and `readSummariesView`'s specs cover the set changing);
  - session deletion removing summaries (in `deleteSession`'s spec).

  Found on the way: a recluster queued summaries without running the job runner, so a summary could wait for the next wake alarm. The recluster now runs the jobs.

## 5. The Summaries page

- [x] 5.1 Add the `ClusterSummaries` component and `app/summariesApp`, with `entrypoints/summaries`. Cover:
  - statements with citation links and quotes;
  - stale dimming with "Refresh";
  - "Summarize now";
  - no facts;
  - refresh polling.

  Verify with component and app specs.

- [x] 5.2 Popup: a "Summaries" button beside "What was recorded". Verify with popup specs. Add `e2e/specs/summaries.e2e.ts`: the popup opens the page, and a session without facts says so. Its fixture helpers get their own specs.

## 6. Documentation and verification

- [x] 6.1 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`:
  - tick "Cluster summaries with citations and staleness";
  - note the page in place of the sidebar for now;
  - record the 60-fact cap, the labels and staleness computed on read.

  Verify that `openspec validate add-cluster-summaries --strict` passes.

- [x] 6.2 Run `npm run verify` and confirm that it passes.

## Deferred

The maintainer deferred the manual run on 2026-10-13 ("оставь ручные проверки на потом"); it is carried to follow-up work rather than left open here.

- On a session with extracted facts, open Summaries and choose "Summarize now". Record in design.md Findings the statements, whether each citation supports its statement, and the time taken.
