# Tasks

## 1. Probe plumbing

- [x] 1.1 Add the `diagnostics` store to `shared/storage` with a forward-only migration. Its heartbeat rows hold the run id, strategy, elapsed ms and a timestamp, and no content. Verify with the migration spec: an existing database upgrades, and the store is empty.
- [x] 1.2 Add the pure helpers the probe needs to `features/diagnostics`. One builds a heartbeat row, and one reads a run's outcome from its rows: completed, last seen at _t_, or resumed after an unload. Verify with specs for each outcome, including a gap longer than the idle timeout.
- [x] 1.3 Add `holdBackgroundAlive` to `features/jobQueue`. Its browser call is a dependency, and it covers the `apiActivity` strategy with the candidate calls from design decision 2. It returns a release function, and release stops the calls. Verify with fake-timer specs for the 10 s interval, release, and release after a throw.
- [x] 1.4 Background: the `diagnostics.lifetimeProbe` message starts a run with `{ strategy, holdMs }` and answers at once with the run id. Heartbeats are written every 2 s. `wakeAndResume` checkpoints through the job queue, and `hostPage` opens and later closes a minimal extension page that connects a port. Verify with `app/backgroundApp` specs for each strategy's wiring, using fake browser dependencies.
- [x] 1.5 Options page: a "Background lifetime" card, closed by default, under a "Developer" section. It has a strategy picker, a hold length, a start button and a list of runs with their outcomes, and reads the outcomes after reopening the page. Verify with component specs for the closed default, starting a run, and showing each outcome.

## 2. Phase A: measure in e2e

- [x] 2.1 Shorten `extensions.background.idle.timeout` for the lifetime spec only, set from the chrome context by `e2e/fixtures/backgroundLifetime` (`setBackgroundIdleTimeout`) rather than through `buildProfilePreferences`, so other spec files keep the default (see Findings). Verify with the fixture's specs.
- [x] 2.2 Write `e2e/specs/backgroundLifetime.e2e.ts`. With the timeout set to 8 s, it runs each strategy with a 20 s hold, closes the options page right after starting, waits, reopens it, and reads the outcome. Verify that the suite runs, and record each strategy's outcome in design.md Findings. `none` is expected to fail, which confirms the harness detects an unload.
- [x] 2.3 Apply decision rule 3 to the results and record the chosen strategy in Findings. If the choice is `hostPage` or neither, stop here and revise the `job-queue` delta and the tasks with the maintainer before group 3.

## 3. Phase B: runner keeps alive and wakes itself

- [x] 3.1 Add `getNextWakeTime(jobs, now)` to `features/jobQueue`. It returns now + 1 min while a job is running. Otherwise it returns the earliest queued job's due time, no sooner than now + 1 min. It returns nothing when nothing is queued or running. Verify with specs for no jobs, a due job, a retry 2 minutes out, only running jobs, and only failed jobs.
- [x] 3.2 In `app/backgroundApp`:
  - requeue running jobs before the first claim after each page load;
  - run jobs inside `holdBackgroundAlive`, released in `finally`;
  - after each pass, set or clear the `jobs.wake` alarm from `getNextWakeTime`;
  - add `handleAlarm`, which runs due jobs.

  Verify with background specs for:
  - a job left `running` being requeued and completed on load, without `reconcileSession`;
  - the hold being taken and released around a job;
  - the alarm being cleared when the queue empties;
  - an alarm wake completing a checkpointed job.

- [x] 3.3 Background entrypoint: add `alarms` to the manifest permissions in `wxt.config.ts`, and register `browser.alarms.onAlarm` synchronously, forwarding to `handleAlarm`. Supply the alarm and keep-alive calls as dependencies. Verify that the built manifest's `permissions` match the delta scenario exactly, and update any manifest spec or e2e check that lists them.
- [x] 3.4 Switch `generation.measure` to `holdBackgroundAlive`. It keeps the 1 s progress posts for the card. Verify that its background spec still passes and asserts that the hold is released.
- [x] 3.5 Extend `backgroundLifetime.e2e.ts` with the real runner: a `jobRunner` probe strategy holds through the same `holdForJob` every job runs under. With the timeout at 8 s and a 20 s hold, the spec checks that it completes, that `apiActivity` completes, that `none` is stopped and that `wakeAndResume` is resumed; `hostPage` is recorded only. Verify that the e2e passes.

## 4. Documentation

- [x] 4.1 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`: tick M0-1 and rewrite it to its re-scoped question with the result, update the risk table row on event-page unload, and add `alarms` wherever permissions are listed. Verify that `openspec validate spike-event-page-lifetime --strict` passes.
- [x] 4.2 Run `npm run verify` and confirm that it passes.

## 6. Close-out

- [x] 6.1 Record the M0-1 decision at the top of Findings in one paragraph: which strategy, the evidence, and what M4 jobs can rely on.

## Deferred

The maintainer deferred these on 2026-10-13 ("оставь то что нужно от меня на потом"). They are carried
to follow-up work rather than left open here.

- Manual check, Firefox release on macOS with the default timeout: run the probe with "Job runner
  (chosen)" and a 120 s hold, closing every extension page right after starting. Record the outcome
  and Firefox's version.
- With Ollama running `qwen3:4b`, start a generation that takes more than 60 s with no surface open.
  Confirm in Ollama's log that the request ran to completion rather than ending at 30 s. This may
  need a probe variant that waits on a real answer.
- Repeat the first check on ESR 140 and on Linux if either is available. Otherwise record each as
  not checked.
- Keep the probe card under "Developer", or remove it with the heartbeat store. Until the
  maintainer answers, it stays, which is the default.
