# Tasks

## 1. Spike

- [x] 1.1 Probe Firefox 157's close and restore paths for groups and tabs from an extension page and the chrome context, and record the Findings in design.md. The probe page and the probe spec were removed afterwards.

## 2. Storage

- [x] 2.1 Add `closed` to `SessionStatus` and `formerGroupIds` to `StoredSession`. Raise `DATABASE_VERSION` to 6, with a step that gives existing sessions an empty `formerGroupIds`. Extend the `applyDatabaseUpgrade` spec so that a version-5 session gains `formerGroupIds: []`.

## 3. Session model

- [x] 3.1 Add `closeSessionForGroup`, `reopenSessionForGroup`, `rekeySession` and `getLiveSession`, each with a spec on `fake-indexeddb`. Remove `endSessionForGroup`.
- [x] 3.2 `createSession` ends a closed session in its own transaction. `reconcileActiveSession` closes an active session whose group is missing, and reopens a closed session whose group exists. Update their specs and the `startSession` spec, including a refusal when a closed session's group is back.
- [x] 3.3 Add `SessionTabApi`, `SESSION_TAB_VALUE_KEY` and `NO_TAB_GROUP`.
- [x] 3.4 Add `restoreSessionTab`, with a spec covering every outcome: `member`, `joined` (including a former group's tab), `adopted`, `regrouped` and `ignored`.
- [x] 3.5 Add `trackSessionTabMembership`, with a spec covering a tab joining (marked), a tab leaving (unmarked), and an unrelated tab.
- [x] 3.6 Add `closedSession` to `session.active`.

## 4. Background

- [x] 4.1 `BackgroundApp`:
  - add the `sessionTabs` dependency and `handleGroupCreated`, `handleTabCreated` and `handleTabGroupChanged`;
  - `handleGroupRemoved` closes the session on any removal;
  - serialize all session work;
  - mark the first tab after a start;
  - answer `closedSession`.

  Extend `app/backgroundApp/index.spec.ts`, including two tabs restored at once ending in one group.

- [x] 4.2 In `entrypoints/background`, register `tabGroups.onCreated`, `tabs.onCreated`, and `tabs.onUpdated` with `{ properties: ["groupId"] }`, synchronously, and pass `sessions.*` and the grouping calls. Declare `sessions` in `wxt.config.ts`.

## 5. Popup

- [x] 5.1 Show the closed session beside the form (`session-closed`). Update the popup spec.

## 6. End-to-end

- [x] 6.1 Add `e2e/fixtures/sessionRestore/` with these helpers, each with its unit spec:
  - `startPageServer`, `openPageInGroup`, `buildGroupPageOpenerScript`;
  - `runChromeAfterFlush`, `buildFlushedChromeScript`, `parseChromeResult`;
  - `undoCloseTab`.

  Add `closedSession` to the popup snapshot.

- [x] 6.2 Add `e2e/specs/sessionRestore.e2e.ts` with three scenarios: a deleted group closes and reopens the session; a tab restored after its group is gone comes back in a group titled after the session; a new start ends a closed session.

## 7. Verification

- [x] 7.1 Run `npm run verify` and `openspec validate add-session-restore`. Verify that the built manifest lists `tabGroups` and `sessions`, and not `tabs`.
- [ ] 7.2 Manual check in a regular profile: a restart between closing and restoring, for each way of closing a group (design.md, Open questions).
