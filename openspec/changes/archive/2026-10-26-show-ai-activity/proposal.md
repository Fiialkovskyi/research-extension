# Proposal

## Why

Once AI is set up, the popup says nothing about it. The local model works in the background for
minutes at a time: it reads pages, extracts facts and summarizes topics. The user cannot tell
whether it is working, waiting, stuck or done. The silence reads as "broken". Users then reload
pages or reopen the popup to find out, and the setup work feels wasted.

## What Changes

- The popup gets a one-line **AI activity strip** under its header. It is shown whenever AI is set
  up and is never hidden. It is in exactly one of four states:
  - **Working**: what the model is doing, in plain words, and how far the current batch has got
    ("Extracting facts · 3 of 12"). A progress bar fills by batch. When the batch is a single job,
    the bar moves without filling and the strip shows how long the job has run.
  - **Waiting for you**: text generation is held back while the user is active, as it is today.
    The strip says so and how much is waiting, instead of looking idle.
  - **Paused**: Ollama is not answering. The strip says so, says how much is waiting, and links
    to the setup page.
  - **Ready**: nothing is pending. The strip says that everything is processed and what AI has
    done for the active session ("14 pages read · facts from 12 · 3 summaries").
- When jobs in the current batch failed for good, the strip adds how many, in any state.
- The strip follows the queue live. The background announces a new `jobs` data topic when a job
  is enqueued, claimed or settled, or when AI pauses or resumes. The popup reads a summary of
  the queue again.
- The background answers a new request with that summary. The summary is derived from the job
  store alone, so it survives the background being unloaded.
- While AI is not set up, the strip is not shown. The existing setup banner covers that state.
- A pause no longer outlives Ollama's absence. Pause is the last failure remembered, so before
  this change it stayed until the next page was read, even right after setup had just talked to
  Ollama. Turning AI on, or the popup showing a pause, now asks Ollama once and resumes the work
  if it answers.
- The popup's separate "AI is paused" line under the session goes: the strip says it.

Out of scope: a badge on the toolbar icon for activity, per-page marks in the research tree, a
queue panel with retry and pause, and streamed generation text. Each of these can follow
separately.

## Capabilities

### New Capabilities

- `ai-activity`: what the extension tells the user about the local model's background work. It
  covers which states exist, how a batch and its progress are counted, what the resting state
  says, and how quickly the display follows the queue.

### Modified Capabilities

- `model-runtime`: in "A local inference server can serve a registered model", the popup reports a
  pause through the activity strip rather than a separate line, and paused work also resumes when
  AI is turned on or when the popup shows the pause.

The `job-queue` requirements are unchanged: this change reads the queue and does not alter how it
claims or retries jobs.

## Impact

- `src/features/jobQueue`:
  - a new pure summary of pending, running and recently settled jobs;
  - an optional hook in `runNextJob` that reports a claimed job.
- `src/shared/storage`: migration 23 adds an `updatedAt` index on the jobs store. It lets the
  summary read recently settled jobs without scanning every job ever done.
- `src/features/liveData`: a `jobs` topic.
- A new `src/features/aiActivity` feature:
  - `model/` turns the queue summary and the pause state into one display state;
  - `ui/activityStrip` renders that state.
- `src/app/backgroundApp`: answers `aiActivity.read` and announces `jobs`.
- `src/app/popupApp` and `src/entrypoints/popup`: render the strip and follow data changes.
- E2E: one popup spec covering the ready state after setup.
- No new permissions, no network behaviour, no manifest change.
