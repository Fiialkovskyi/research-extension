# Proposal

## Why

Long work — embedding a session's chunks, extracting facts — has to survive the background event page being unloaded in the middle of it (REQ-RT-005), must not be done twice for the same inputs, and must give up visibly rather than retry forever (REQ-STO-010). That needs a durable queue in the database. It is the third MVP database change, after sessions (version 3) and the graph (version 4); the first job types arrive with embeddings in M2.

## What Changes

- **A `jobs` store** joins the database in migration step 5, indexed by `[status, priority]`.
- **A job's id is its identity:** the SHA-256 of its type, its input hashes and its producer version. Enqueuing the same work again finds the existing job instead of adding one.
- **Functions in a new `jobQueue` feature:**
  - `enqueueJob` adds a job, skips a duplicate that is queued, running or done, and re-queues one that had failed for good;
  - `claimNextJob` takes the highest-priority queued job that is due and marks it running, in one transaction;
  - `checkpointJob` records progress on a running job;
  - `completeJob` marks it done and drops its checkpoint;
  - `failJob` retries it with exponential backoff up to 3 times, then leaves it `failed` with the reason;
  - `requeueRunningJobs` returns jobs left running by an unloaded page to the queue, checkpoint intact, so they resume.

## Capabilities

### New Capabilities

- `job-queue`: durable, idempotent, checkpointed background jobs with bounded retries.

### Modified Capabilities

None.

## Impact

- **Modified:** `src/shared/storage` (`JOB_STORE`, `StoredJob`, `JobStatus`, step 5, `DATABASE_VERSION = 5`).
- **New:** `src/features/jobQueue/`.
- **Out of scope:**
  - the runner and scheduler: when to claim, idle windows, `alarms` (REQ-MOD-008), and the 10-second checkpoint cadence, which is the runner's to keep;
  - calling `requeueRunningJobs` on wake, which the runner does when it exists;
  - job types and their checkpoint schemas;
  - deleting a session's jobs (STO-008), and the `sessionId` index it will need.
