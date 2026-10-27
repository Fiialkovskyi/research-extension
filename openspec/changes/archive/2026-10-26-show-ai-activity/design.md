# Design

## Context

- All model work goes through the durable job queue (`features/jobQueue`). A `StoredJob` has
  `type`, `status` (`queued | running | done | failed`), `sessionId`, `payload`, `createdAt` and
  `updatedAt`. Done and failed jobs are kept. The store has two indexes: `statusPriority` and
  `sessionId`.
- The background drains the queue in `runJobs` (`app/backgroundApp`), one job per `runNextJob`
  pass. It calls `notifyDataChanged([...])` after each settled job.
- Generation jobs are `extractFacts`, `summarizeCluster` and `suggestQuestions`. They are claimed
  only while `isUserAway()` holds, or when the user asked for them (`isRequested`). Otherwise they
  stay queued.
- `isLocalAiPaused(database)` says whether Ollama last failed to answer. It already drives the
  toolbar badge through `refreshBadge`.
- Live pages work through `features/liveData`:
  - the background announces topics on a port;
  - surfaces call `useDataChanges(client.watch, topics, reload)`, as `recordedApp` and
    `summariesApp` do.
  - The popup does not follow data changes yet; it reads `aiSetup.read` once on open.
- The popup UI is in English, and its components use Tailwind and `shared/ui`.

## Goals / Non-Goals

**Goals:**

- One derived, storage-only activity summary that is correct after the event page was unloaded.
- One request for the popup to read and one live topic to follow, in the pattern the other
  surfaces already use.
- All display decisions in pure functions with unit tests. The component only renders.

**Non-Goals:**

- No progress inside a job. Ollama answers non-streamed today, and a checkpoint's shape is private
  to each job type.
- No change to how the queue claims, retries or gates jobs.
- No change to the toolbar badge.

## Decisions

### 1. The batch is derived from the store, not tracked in memory

The current batch starts at `batchStartedAt`, the earliest `queuedAt` among queued and running
jobs. `queuedAt` is a new optional field on `StoredJob`:

- `enqueueJob` sets it when it queues new work, and again when it queues a job that failed for
  good.
- Claims, retries and defers leave it alone, so a retried job stays in its batch.
- A job written before this change has no `queuedAt`, and its `createdAt` stands in.

`createdAt` alone would not do: a job queued again after failing keeps its original
`createdAt`, which would stretch the batch back to the day it first ran.

The batch's jobs are:

- the pending jobs (queued and running);
- jobs settled since then: done or failed with `updatedAt >= batchStartedAt`.

Settled counts done and failed jobs together, so the bar reaches the end even when some fail.

- This matches the spec: a batch begins when work arrives while nothing is pending, and grows
  until the queue empties.
- It needs no new store and survives the background being unloaded.
- _Alternative: an in-memory counter in the background._ Rejected: it is lost whenever Firefox
  unloads the event page, which is exactly when long batches run.
- _Alternative: a persisted "batch" record updated on enqueue._ Rejected: every enqueue site
  would have to write it in the same transaction, and a missed site would silently miscount.

When nothing is pending, there is no current batch. The ready state then reports per-session
totals (decision 4). Its failure count is the active session's work that failed for good and has
not been done since. That work stays outstanding until it is asked for again, so it should stay
visible. A "most recent batch" cannot be recovered once the queue has emptied.

### 2. Migration 23 adds an `updatedAt` index on jobs

Reading jobs settled since `batchStartedAt` uses `IDBKeyRange.lowerBound(batchStartedAt)` on the
new index. Done jobs accumulate for the life of the database, so a scan of `statusPriority` for
`done` would grow without bound and run on every popup update.

The migration is forward-only and adds an index only, so it needs no data rewrite.

### 3. The summary lives in `jobQueue`; the display state lives in a new `aiActivity` feature

- `jobQueue/model/readJobActivity(database, now)` returns:
  - the running job's `type` and the `updatedAt` it was claimed at;
  - queued counts by type;
  - `batchStartedAt`, the batch size and settled and failed counts;
  - per-type distinct done counts for a given `sessionId`.

  It is plain data with no wording.

- `aiActivity/model/getActivityState(summary, { isPaused, isAway, hiddenTypes })` picks the
  state in the spec's order and returns a discriminated union: `paused | working | waiting |
  ready`. "Waiting" means jobs are queued, none is running, and every queued job is a generation
  job while the user is active.
  - The background passes `isAway` because only it can read the idle state.
  - It also passes requested generation jobs as permitted, so they count as work about to run.
- `aiActivity/model/getWorkLabel(type)` maps a job type to the words the strip uses. Diagnostics
  types map to `undefined`, and such jobs are dropped from every count before the state is picked:

  | Type               | Label                |
  | ------------------ | -------------------- |
  | `embedSnapshot`    | Reading pages        |
  | `extractFacts`     | Extracting facts     |
  | `resolveEntities`  | Matching entities    |
  | `summarizeCluster` | Summarizing topics   |
  | `suggestQuestions` | Suggesting questions |

- `aiActivity/ui/activityStrip` renders one state:
  - a `StatusDot`, the line of text and a bar;
  - a CSS-animated indeterminate bar for a lone job, with an elapsed timer kept by a 1 s
    interval in the component;
  - an action button in the paused state.

Why split it this way: the queue feature owns the store and the counting; the new feature owns
the meaning for the user. The background can import both barrels without React.

### 4. Ready totals count distinct work, not job rows

A page re-embedded after a model change leaves two done `embedSnapshot` jobs. So the ready
totals count distinct `inputHashes` keys per type, for done jobs of the active session:

- "N pages read" from `embedSnapshot`;
- "facts from N" from `extractFacts`;
- "N summaries" from `summarizeCluster`.

Matching entities and suggestions have no per-page meaning and are left out of the totals.

- _Alternative: read the derived records (snapshots with vectors, facts, summaries)._ Rejected
  for now: it couples the strip to three features' storage. The job store already records what
  was done.

### 5. Live updates: a `jobs` topic announced at the four points where the queue changes

- `DATA_TOPICS` gains `jobs`.
- The background calls `notifyDataChanged(["jobs"])` at four points:
  - when `runJobs` starts a pass, which covers enqueues, since every enqueue site triggers
    `runJobs`;
  - when a job is claimed, through a new optional `onClaimed(job)` hook on `RunNextJobOptions`;
  - after a job settles, by adding `jobs` to the existing call;
  - when the paused flag changes, where `refreshBadge` already notices it.
- `notifyDataChanged` already coalesces bursts, which keeps traffic to one message per burst.
- The popup client gains `watch`, wired in `entrypoints/popup` exactly as in the other surfaces.
  The popup calls `useDataChanges(client.watch, ["jobs", "models"], reload)`. `models` also
  re-reads `aiSetup.read`, so the banner gives way to the strip as soon as setup finishes.

### 6. Request shape

`aiActivity.read {}` answers `aiActivity.state` with the state from decision 3, already decided.
The popup does not re-derive anything.

- The payload carries `startedAt` for a running job, not an elapsed time, so the popup's timer
  stays correct between updates.
- `isAway` changes without any job changing. The background therefore re-announces `jobs` from
  the `idle.onStateChanged` listener that `entrypoints/background` already registers.

### 7. A pause is re-checked when it matters, not polled

`isLocalAiPaused` is derived from jobs whose last failure names Ollama. It stays true until
`resumeLocalAi` requeues them, and that used to run only on the next captured page or when the
setup or options page asked for status. In practice this let setup finish ("AI is on") while
the popup still said paused.

- `turnOnAi` ends with `queueSnapshotWork()`, which resumes and runs. Ollama has just answered
  every step.
- `aiActivity.read` fires `resumeLocalAi().then(runJobs)` without waiting for it, whenever it
  reports paused.
  - That is one `/api/tags` request per popup read while paused.
  - It is never sent before setup started: pause requires an active Ollama model.
  - When it resumes, the `jobs` announcement moves the strip on.
- _Alternative: poll health on an alarm._ Rejected: it contacts Ollama with nobody looking, and
  the next capture already covers the unattended case.
- The popup's old `local-ai-paused` line and its `ollama.health` request are removed. The strip
  covers the same state and leads to the same page.

## Risks / Trade-offs

- [The idle state changes without a queue event, so a popup open across that moment can show
  "waiting" a little too long] → Re-announce `jobs` when idle state changes. The background
  already reads idle state, so the listener is registered synchronously with the others.
- [`batchStartedAt` uses the oldest pending job. A job stuck in backoff for a long time keeps one
  batch open across separate bursts of work] → Acceptable: the count stays truthful, as the work
  really is outstanding. The failed and retry semantics are unchanged.
- [Jobs enqueued with `notBefore` in the future (debounce) count as pending, so the strip may say
  "working" or "waiting" a few seconds before anything runs] → A
  first attempt that is not yet due (`attempts === 0`, `nextAttemptAt > now`) is not pending and
  does not open a batch. A retry waiting out its backoff is still pending: it is outstanding
  work in the batch. While only such retries remain, the strip shows working with the next job's
  label.
- [Migration 23 on a large store] → It only creates an index. Building it is proportional to the
  number of jobs and runs once.

## Migration Plan

- Database version 22 → 23 adds the index. Rollback is not supported by forward-only migrations.
  An older build would refuse the newer database, as with every earlier migration.
- No settings or manifest change.
