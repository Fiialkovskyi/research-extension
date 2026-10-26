# Tasks

## 1. Marking waiting jobs

- [x] 1.1 Extract the marking in `facts.extractNow` into a helper that sets `requestedAt` on the given job ids in one transaction. Verify with its unit test and the unchanged `facts.extractNow` tests.
- [x] 1.2 Add `aiActivity.runNow` and `aiActivity.runStarted` to the `aiActivity` schemas and barrel. Verify with `npm run typecheck`.

## 2. Background

- [x] 2.1 Handle `aiActivity.runNow` in `backgroundApp`: mark the queued generation jobs, call `runJobs()`, answer `aiActivity.runStarted` with the count. Verify with unit tests: held jobs run while the user is active; a job enqueued afterwards does not; an empty queue answers 0.
- [x] 2.2 Verify the mark survives an unload: with the background rebuilt over the same database, the marked jobs still run without a second request.

## 3. Strip and popup

- [x] 3.1 Add a "Run now" button to the waiting row of `ActivityStrip` with an `onRunNow` prop; absent in the other states. Verify with component tests for each state.
- [x] 3.2 Send `aiActivity.runNow` from `popupApp` on press and disable the button while the request is in flight. Verify with a `popupApp` test that the message is sent once.

## 4. Wrap-up

- [x] 4.1 Remove "Run waiting AI work on demand" from `docs/BACKLOG.md`.
- [ ] 4.2 Run `npm run verify`.
