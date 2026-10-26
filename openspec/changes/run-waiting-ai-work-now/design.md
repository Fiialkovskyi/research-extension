# Design

## Context

Text-generation jobs (`GENERATION_JOBS` in `backgroundApp`) are claimable only while the user is
away, or when the job's payload carries `requestedAt` (`isRequested`). `readJobPermission` builds
that gate once per pass and feeds both `runNextJob` and `aiActivity.read`, so the strip's waiting
state is exactly "pending work, none permitted". `facts.extractNow` already marks pending jobs in
one transaction and calls `runJobs()`. Embedding jobs are not gated, so waiting always means
generation jobs.

## Goals / Non-Goals

**Goals:**

- One press runs the jobs held at that moment, durably, with no change to the idle rule.

**Non-Goals:**

- A session-wide or persistent override of the idle rule.
- Running a single job, or choosing which jobs to run.
- Changing the paused state or retry backoff.

## Decisions

- **Reuse the per-job `requestedAt` mark instead of an in-memory "next pass" flag.** The mark is
  durable, so it survives an event-page unload, and it limits the request to jobs that exist at the
  press, which is the "once" the user asked for. A flag would be lost on unload and would also admit
  jobs enqueued later in the same pass. Alternative rejected: a flag stored in settings, which needs
  clearing and a migration.
- **Mark queued generation jobs, not only those the strip counted.** The handler selects jobs of a
  `GENERATION_JOBS` type in `queued` status, sets `requestedAt` in one transaction and then calls
  `runJobs()`. Running jobs are left alone; fact extraction already re-reads its own mark between
  chunks through `mayExtractNow`.
- **Extract the marking.** `facts.extractNow` marks jobs inline; both handlers need the same
  transaction, so it becomes a helper beside the job queue rather than a second copy.
- **A new message `aiActivity.runNow`, answered `aiActivity.runStarted { marked }`.** The strip
  needs no payload from the answer; it updates through the `jobs` topic like every other change.
  `marked` is returned so a test and a future caller can tell a no-op press from a real one.
- **The control sits in the waiting row only.** Other states have nothing held, so the control
  would do nothing there.

## Risks / Trade-offs

- A press while the queue was empty by the time the request lands marks nothing; the answer's
  `marked: 0` makes that visible and the strip simply re-reads.
- A job marked and then failed keeps its mark through retries, so a retry also ignores the idle
  rule. This matches `facts.extractNow` today and is accepted.
