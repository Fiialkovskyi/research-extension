# Tasks

## 1. Popup layout and the removed Switch flow

- [x] 1.1 Widen the popup panel to 26rem and show Delete beside Resume with no `⋯` menu; verify `popupOpens.e2e.ts` expects 416 and the `sessionPicker` unit tests pass (already in the working tree).
- [x] 1.2 Delete `switchSession`, its spec, the `switch-session`/`switch-cancel`/`switch-warning` controls and the "Close current and switch" label, and the `shouldReconcile` flag on `resumeSession`; verify `npm run typecheck` is clean and no reference to them remains (`grep switchSession src` is empty).

## 2. Session lookup by group

- [x] 2.1 Add `listLiveSessions`, `getSessionForGroup` (matching `groupId` or `formerGroupIds`) and `getSessionForTab` to `researchSession`, each a directory with its own spec; verify specs cover two sessions, a former group id, and a tab in no session.
- [x] 2.2 Replace `reconcileActiveSession` with `reconcileSessions` (close, reopen and rename per live session) and make `closeSessionForGroup` / `reopenSessionForGroup` assume several sessions; verify specs with two active and one closed session reconcile independently.
- [x] 2.3 Delete `getActiveSession`, `getLiveSession` and `assertNoActiveSession`, so every remaining call site fails to compile; verify the compiler errors list the call sites handled in groups 3 to 6 (do not stub them).

## 3. Starting and resuming without refusals

- [x] 3.1 Remove the single-session refusal and the "end the closed session" write from `startSession` and `createSession`; assert one group id belongs to at most one session; verify specs: two starts yield two sessions, starting beside a closed session leaves it closed.
- [x] 3.2 Remove the refusal and the ending of a closed session from `resumeSession`; refuse only a session that is already live; verify specs: resuming beside an active session leaves it untouched, resuming a live session is refused.

## 4. Capture follows the tab's group

- [x] 4.1 Rewrite `followTabMembership` to close the node a tab had in the session it left and record into the session it joined; verify a spec that drags a tab from group A to group B.
- [x] 4.2 Resolve the session through `getSessionForTab` in `recordNavigation`, `closeTabNode`, `updateTabTitle`, `recordTabFocus`, `trackActiveDwell`, `reconcileSessionTabs`, `restoreSessionTab`, `trackSessionTabMembership` and `injectSessionTabs`; verify each spec with two sessions shows the other graph unchanged.
- [x] 4.3 Keep `recordSessionTabs` saving every live session's tabs; verify a spec that two sessions each keep their own `savedTabs`.
- [x] 4.4 Add an e2e that reads pages in two groups and checks the two graphs do not mix; verify `npm run test:e2e` passes it.

## 5. The viewed session

- [x] 5.1 Add the `viewed-session` model: read and choose the viewed session through `viewedAt` on the stored session, with the fallback order from the design; verify specs for each fallback and for a deleted session.
- [x] 5.2 Answer `session.getActive` with the session list and viewed id, add `session.view`, and set the viewed session on start and resume; verify `backgroundApp` specs for each message and that choosing a session opens and closes nothing.
- [x] 5.3 Announce a `viewed` data topic so pages that follow the viewed session refresh; verify a `liveData` spec.

## 6. Pages pinned to a session

- [x] 6.1 Give `openMap`, `openRecorded` and `openSummaries` an optional session id carried as `?session=`, finding an open tab by full URL; verify specs: same session selects the open tab, another session opens a second.
- [x] 6.2 Make `graph.subscribe` take a `sessionId` and push only that session's snapshots; verify a `backgroundApp` spec with two sessions and two ports.
- [x] 6.3 Make the map, "What was recorded" and summaries read their session from the URL or the viewed session, name it in the heading and `document.title`, and say so when it is gone; verify component specs for each of the three cases.

## 7. AI work per session

- [x] 7.1 Give the AI enqueuers (`enqueueSnapshotEmbeddings`, `enqueueFactExtractions`, `enqueueEntityResolutions`, `enqueueClusterSummaries`, `enqueueOpenQuestions`) and `reclusterActiveSession` an explicit `sessionId`, supplied by the capture step or run once per live session; verify specs with two sessions that jobs carry the right id.
- [x] 7.2 Point `readComparisonTable`, `saveTableColumns`, `readResearchGaps`, `openGapSearch`, `readOpenQuestions` and `requestOpenQuestions` at a `sessionId`; verify their specs.

## 8. Popup

- [x] 8.1 Render the select over live then saved sessions with the viewed one chosen, an always-enabled `＋`, and Resume beside Delete; choosing a live session calls `session.view`; verify `sessionPicker` and `popupApp` specs, including two active sessions and no active session.
- [x] 8.2 Show the viewed session's page count, "You left off", re-attach offer, map, recorded and summaries buttons; verify `popupApp` specs, and update the e2e popup snapshot reader and `saveAndResume`/`sessionRestore` specs for the select.
- [x] 8.3 Update `openspec/specs` through archive, `RESEARCH_GRAPH_EXTENSION_SPEC.md` (`REQ-CAP-004`, `REQ-RT-001`) and `docs/BACKLOG.md` (remove the entry); verify `openspec validate support-parallel-sessions` passes and the docs mention no single-session rule.

## 9. Integration

- [x] 9.1 Run `npm run verify`: typecheck, lint, tests and `npm run test:e2e` (26 specs) pass; `format:check` reports only the untouched `save-research-automatically/design.md`.
- [ ] 9.2 Deferred, by hand in Firefox: two sessions recording at once, a restart that restores only one group, resuming beside an active session, and two maps side by side.
