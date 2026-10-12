# Tasks

## 1. Storage

- [x] 1.1 Add `JOB_STORE`, `JobStatus`, `StoredJob` to `src/shared/storage`; raise `DATABASE_VERSION` to 5; step 5 creates `jobs` with the `statusPriority` index. Extend the upgrade specs: the store and index exist, and a version-4 profile keeps its graph.

## 2. Queue model

- [x] 2.1 Add `src/features/jobQueue/` with `constants.ts` (`JOB_RETRY_LIMIT`, `JOB_RETRY_BASE_DELAY_MS`), types and barrel.
- [x] 2.2 `buildJobId` with a spec: stable, order-insensitive over input hashes, different for another producer version.
- [x] 2.3 `enqueueJob` with a spec covering each row of the duplicates table.
- [x] 2.4 `claimNextJob` with a spec: priority order, not-yet-due skipped, two concurrent claims get one job.
- [x] 2.5 `checkpointJob`, `completeJob`, `failJob` with specs: checkpoint kept, done drops it, backoff 30/60/120 s, fourth failure is final.
- [x] 2.6 `requeueRunningJobs` with a spec: running jobs queued, due now, checkpoint and attempts kept; others untouched.

## 3. Verification

- [x] 3.1 Update `docs/codeGuide/STORAGE.md`; run `npm run verify` and `openspec validate add-job-queue`.
