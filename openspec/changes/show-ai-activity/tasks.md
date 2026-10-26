# Tasks

## 1. Store: index jobs by `updatedAt`

- [x] 1.1 Add migration 23 creating an `updatedAt` index on the jobs store, bump `DATABASE_VERSION` and the store's index typing. Verify with the migration's unit test: an upgrade from 22 keeps existing jobs and the index answers a `lowerBound` range.

## 2. Queue: activity summary and claim hook

- [x] 2.0 Add an optional `queuedAt` to `StoredJob`, set by `enqueueJob` for new and re-queued failed jobs and kept by claims, retries and defers. Verify with `enqueueJob` unit tests.
- [x] 2.1 Add `jobQueue/model/readJobActivity(database, now, sessionId?)`. It returns:
  - the running job's type and `startedAt`;
  - due queued jobs by type, excluding jobs not yet due;
  - `batchStartedAt`, the batch size, and its settled and failed counts, read through the new index;
  - distinct done counts by type for the session.

  Verify with unit tests in fake-indexeddb for:
  - an empty queue;
  - a batch under way;
  - work added mid-batch (2 of 4 → 2 of 7);
  - failures inside and outside the batch;
  - a job not yet due being ignored;
  - a re-embedded page being counted once.

- [x] 2.2 Add an optional `onClaimed(job)` to `RunNextJobOptions`, called after the claim and before the runner. Verify with a `runNextJob` unit test that it is called once, with the claimed job, before the runner.
- [x] 2.3 Export both from the `jobQueue` barrel. Verify with `npm run typecheck`.

## 3. The `aiActivity` feature model

- [x] 3.1 `getWorkLabel(type)` maps the five job types to their labels and returns `undefined` for diagnostics and unknown types. Verify with unit tests.
- [x] 3.2 `getActivityState(summary, { isPaused, isAway, isPermitted })` returns `paused | working | waiting | ready`, in the spec's order, with jobs that have no label dropped from all counts. Verify with unit tests per spec scenario, including:
  - paused over working;
  - waiting only when every due job is a held-back generation job;
  - ready totals that leave out zero kinds;
  - the failure count in each state.
- [x] 3.3 Add the `aiActivity.read` request and `aiActivity.state` response schemas in `schemas.ts`, and the feature barrel, with no `ui/` in it. Verify with `npm run typecheck`.

## 4. The activity strip component

- [x] 4.1 `aiActivity/ui/activityStrip` renders each state:
  - working with a determinate bar (`role="progressbar"` with `aria-valuenow`);
  - a lone job with an indeterminate bar and an elapsed timer ticking every second;
  - waiting;
  - paused with an "Open setup" action;
  - ready with totals;
  - "N didn't finish" whenever failed > 0.

  Verify with Testing Library tests per state, using fake timers for the elapsed time.

## 5. Background wiring

- [x] 5.1 Answer `aiActivity.read` in `backgroundApp`:
  - read `readJobActivity` for the active session;
  - read `isLocalAiPaused` and the idle state;
  - return `getActivityState`'s result.

  Verify with a backgroundApp unit test for each of the four states.

- [x] 5.2 Add `jobs` to `DATA_TOPICS` and announce it:
  - when a `runJobs` pass starts;
  - from `onClaimed`;
  - after each settled job;
  - when the paused flag changes.

  Verify with backgroundApp unit tests that a subscriber is told `jobs` for an enqueue, a claim and a completion.

- [x] 5.3 Re-announce `jobs` from the existing `idle.onStateChanged` listener in `entrypoints/background`, through the composition root. Verify with a backgroundApp unit test that an idle-state change notifies `jobs`.

## 6. Popup

- [x] 6.1 Give `PopupClient` a `watch` and wire it in `entrypoints/popup` as the other surfaces do. Verify with `npm run typecheck`.
- [x] 6.2 Render `ActivityStrip` under the header while AI is set up. Reload it, and the setup status, through `useDataChanges(client.watch, ["jobs", "models"], …)`. Verify with popupApp unit tests:
  - the banner and no strip when AI is not set up;
  - the strip after a `models` change sets it up;
  - "3 of 12" becomes "4 of 12" on a `jobs` change.
- [x] 6.3 Wire the paused action to the existing `aiSetup.open`. Verify with a popupApp unit test.

## 8. A pause does not outlive Ollama's absence

- [x] 8.1 End `turnOnAi` with `queueSnapshotWork()`. Verify with a backgroundApp test: a job paused on Ollama is requeued after `aiSetup.turnOn`, and the strip is not paused.
- [x] 8.2 In `aiActivity.read`, when paused, fire `resumeLocalAi().then(runJobs)`. Verify with backgroundApp tests: Ollama back means the job is requeued and the strip leaves paused; Ollama away means it stays paused.
- [x] 8.3 Remove the popup's `local-ai-paused` line and its `ollama.health` request. Verify with a popupApp test that the pause is said once, by the strip, and that `ollama.health` is not requested.

## 7. End to end and docs

- [x] 7.1 Add a popup e2e: with an active embedding model seeded and an empty queue, the popup shows the ready strip and no setup banner. Verify with `npm run test:e2e`.
- [x] 7.2 In AGENTS.md, add one sentence to "How a model becomes a vector": the popup's strip reads the queue through `aiActivity`. Verify by re-reading it.
- [x] 7.3 Run `npm run verify` and confirm it passes.
- [ ] 7.4 Manual check on macOS, done by the maintainer: open a session with a few pages, watch the strip go from working to ready, stop Ollama to see paused, and stay active to see waiting for a summary.
