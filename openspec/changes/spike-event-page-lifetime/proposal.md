# Proposal

## Why

Synthesis (M4) runs fact extraction as background jobs, and each one waits on an Ollama answer
that can take longer than 30 s. `add-ollama-generation` found that Firefox unloads the MV3 event
page after 30 s with no activity. An open port did not prevent the unload while the background only
waited on `fetch`. Posting progress every second kept the page alive, but only because a surface
was open to receive it. A synthesis job has no surface: the user may have closed the popup long
before the job starts.

Two gaps follow from that, and M4 cannot be built safely on top of them:

- Nothing is known to keep the page alive through a long wait when no surface is open.
- When the page is unloaded mid-job, the job comes back only on `runtime.onStartup` or
  `onInstalled`, so after a browser restart or an update. An ordinary unload leaves it `running`
  until then, and nothing wakes the page to resume it.

This is roadmap spike M0-1 ("Event-page lifetime"), re-scoped. Its original question was about the
in-extension inference worker. Generation now runs only through Ollama, and embedding batches are
short, so the long wait that matters is a background `fetch` to the local server.

## What Changes

**Phase A: measure.**

- A diagnostic **lifetime probe** in the background. Started from the options page, it holds the
  page busy for a set time under one keep-alive strategy and writes a heartbeat to storage every
  few seconds. The heartbeats show when the page died, even when the page that started the probe
  has been closed.
- Strategies compared, each with no surface open:
  1. **Baseline:** awaiting only. The expected result is an unload after the idle timeout.
  2. **API activity:** a cheap `browser.*` call every few seconds while the job runs.
  3. **Wake and resume:** no keep-alive. An alarm wakes the unloaded page, and the job resumes from
     its checkpoint.
  4. **Host page:** an extension page, opened by the job and owning a port, keeps the background
     alive. This is the fallback with the worst user-facing cost.
- The probe runs in e2e with Firefox's idle timeout shortened through a profile preference. It
  also runs manually against a real Ollama, with a generation longer than 60 s and the default
  timeout. The results go in Findings, and the decision is recorded for M0-1.

**Phase B: apply the decision.**

- The job runner holds the background alive while a job runs, using the strategy phase A chose. A
  generation job then finishes with no surface open.
- Running jobs are handed back to the queue every time the background wakes, not only at startup
  or install.
- An alarm wakes the background while due jobs remain. A job interrupted by an unload therefore
  resumes without waiting for the user or a browser restart.
- `generation.measure` uses the same mechanism instead of its own one-second progress interval.
  The progress messages stay, because the options card shows them.
- `RESEARCH_GRAPH_EXTENSION_SPEC.md` marks M0-1 done, records the result, and updates the risk
  table row on event-page unload.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `job-queue`:
  - a running job keeps the background alive until it settles, with no surface open;
  - interrupted jobs are handed back on every wake, not only after a restart;
  - due jobs wake the background themselves.
- `extension-shell`: the manifest's API permissions add `alarms`, which waking the background for
  due jobs needs.

## Impact

- **Code:**
  - `features/jobQueue` gains the keep-alive and the wake schedule as pure helpers. The browser
    calls they need come in as dependencies.
  - `app/backgroundApp` runs jobs inside the keep-alive, requeues on wake, and schedules the alarm.
  - `entrypoints/background` registers `alarms.onAlarm` synchronously and supplies the browser
    calls.
  - The lifetime probe is a diagnostics-only path: a background message plus an options-page card.
    It is removed or hidden behind a developer section once the decision is recorded (see
    design.md).
- **Manifest:** the `alarms` permission. It shows no install prompt, and it adds no outbound
  connection.
- **Tests:**
  - unit specs for the keep-alive, the wake schedule and the runner;
  - an e2e spec that shortens `extensions.background.idle.timeout`, starts a long job, closes
    every surface, and checks that the job completes. It uses a timer-backed job, because the e2e
    cannot reach a fake Ollama (see `spike-ollama-provider`, decision 4.1).
- **The maintainer's machine:** the manual run needs Ollama with `qwen3:4b` and a prompt long enough
  to take more than 60 s.
- **Out of scope:**
  - fact extraction itself, which is the next change;
  - the deferred Ollama restart check;
  - several sessions.
