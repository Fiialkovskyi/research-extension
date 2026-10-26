# Tasks

## 1. Record the session as the user goes

- [x] 1.1 Replace `researchLibrary/model/saveActiveSession` with `recordSessionTabs`: records the active session's group tabs in order, skips an empty group, an unchanged list and a session that closed meanwhile. Verify with its unit tests.
- [x] 1.2 `closeSessionForGroup` records `lastPosition` (helper `findLastPosition`, moved from saving) and `savedAt`. Verify with unit tests for both.
- [x] 1.3 The background arms a debounced record (`TAB_RECORD_DELAY_MS` 1 s, capped by `TAB_RECORD_MAX_WAIT_MS` 5 s) on every capture event. Verify with a background test: tabs recorded once quiet; closing the group tab by tab keeps them, with the left-off page, and the library lists the session.

## 2. Library and resume

- [x] 2.1 `listSavedSessions` lists closed sessions too. Verify with its unit test.
- [x] 2.2 `resumeSession` accepts a closed session without ending it first, and closes the session's other open pages. Verify with unit tests.

## 3. Remove saving by hand

- [x] 3.1 Remove `session.save` (schemas, handler, the confirmation list), `closeTabsKeepingWindow`, `SAVE_FLUSH_TIMEOUT_MS` and the `closeTabs` dependency and its wiring. Verify with `npm run typecheck`.
- [x] 3.2 Remove the popup's "Save research" button; reword the closed-session line. Verify with popup tests.

## 4. End to end

- [x] 4.1 `saveAndResume` and `sessionReattach` close the group instead of pressing the button; the database snapshot reads `savedTabCount`. Verify by running both specs, and `sessionRestore`, `savedTabGroup`, `popupTabGroup`.
- [ ] 4.2 `npm run verify` on an idle machine.
