# Design

## Context

The database is at version 4. REQ-STO-010 asks for idempotent jobs keyed by `(type, input hashes, producer version)`, checkpoints at least every 10 s, and 3 retries with backoff before a visible failure. REQ-RT-005 asks that a job interrupted by an unload resume from its last checkpoint. No job type exists yet.

## Goals / Non-Goals

**Goals:** a durable queue with the guarantees above, tested without a browser.

**Non-Goals:** running jobs, scheduling them, any job type.

## Decisions

### Record

```ts
type JobStatus = "queued" | "running" | "done" | "failed";

interface StoredJob {
  id: string; // sha256(JSON [type, sorted inputHashes, producerVersion])
  type: string;
  sessionId?: string;
  inputHashes: string[];
  producerVersion: string;
  status: JobStatus;
  priority: number; // higher runs first
  attempts: number; // failed attempts so far
  nextAttemptAt: number; // not claimed before this time
  checkpoint?: unknown; // the job type's own progress record
  failureReason?: string;
  createdAt: number;
  updatedAt: number;
}
```

- Input hashes are sorted before hashing, so the same inputs in another order are the same job.
- The checkpoint is opaque here. Each job type validates its own with a valibot schema when it reads it back; the queue only stores it.
- `sessionId` is kept so the deletion cascade can find a session's jobs; its index is added with that cascade, not before (code guide §6.3).

### Index and claiming

One index, `statusPriority` on `["status", "priority"]`. `claimNextJob` walks it backwards over the `queued` range (highest priority first) and takes the first job whose `nextAttemptAt` has passed, then marks it `running` in the same `readwrite` transaction. Two claims at once therefore cannot take the same job. `requeueRunningJobs` reads the `running` range of the same index.

The hash is computed before the transaction opens: IndexedDB commits a transaction that has no pending request, so awaiting `crypto.subtle` inside one would end it (code guide §6.5).

### Duplicates

| Existing job                | `enqueueJob`                                                       |
| --------------------------- | ------------------------------------------------------------------ |
| none                        | adds it, `queued`                                                  |
| `queued`, `running`, `done` | returns it unchanged                                               |
| `failed`                    | re-queues it with attempts reset: asking again is the user's retry |

### Retries

`failJob` counts the attempt. While attempts ≤ 3 (`JOB_RETRY_LIMIT`), the job goes back to `queued` with `nextAttemptAt = now + 30 s × 2^(attempts−1)` (30 s, 60 s, 120 s). The fourth failure leaves it `failed` with the reason, where a surface can show it. The checkpoint is kept across retries, so a retry resumes rather than restarts.

### Interrupted jobs

A job still `running` when the page wakes was interrupted, not failed: the page was unloaded under it. `requeueRunningJobs` puts it back to `queued`, due now, attempts unchanged, checkpoint kept.

## Risks / Trade-offs

- **No runner, so nothing calls these in production yet.** → Unit tests cover each transition; the runner arrives with the first job type.
- **A job that crashes the page every time is requeued every wake without counting an attempt.** → The runner can count wakes per job if this shows up; recorded here rather than guessed at now.

## Migration Plan

Step 5 creates `jobs` with the `statusPriority` index. No existing store changes.
