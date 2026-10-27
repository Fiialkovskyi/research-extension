## Why

The popup strip says "Runs when you step away · N waiting" while generation jobs (fact extraction,
cluster summaries, open questions) are held until the user is away. The only way to get that work
sooner is to leave the browser idle; the one existing shortcut, "extract facts now", covers a single
kind of work and lives on another surface.

## What Changes

- The strip's waiting state gains a "Run now" control.
- One press lets the jobs waiting at that moment run while the user is active. It is a one-time
  request: jobs enqueued afterwards still wait for the user to be away, and the idle rule stays on.
- The background marks each waiting generation job as asked for, the same mark `facts.extractNow`
  already leaves, so the request survives an event-page unload.
- A new message `aiActivity.runNow` carries the press from the popup to the background; the strip
  re-reads through the existing `jobs` data topic.
- The backlog item "Run waiting AI work on demand" is removed from `docs/BACKLOG.md`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-activity`: the waiting state offers a way to run the held work now. The capability is still
  defined by the unarchived change `show-ai-activity`, so this delta is ADDED on top of it and
  applies once that change is archived.

## Impact

- `features/aiActivity`: strip UI, request and response schemas, barrel.
- `app/popupApp`: sends the request on press.
- `app/backgroundApp`: handles `aiActivity.runNow`, marks the waiting jobs, starts a job run.
- No storage migration: the mark is a field of the job payload that already exists (`requestedAt`).
- No change to the manifest, permissions or network behaviour.
