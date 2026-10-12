# Tasks

## 1. Storage

- [x] 1.1 Add `SESSION_STORE`, `StoredSession` (with `SessionStatus`) and the `sessions` entry of `ResearchDatabaseSchema` to `src/shared/storage`; raise `DATABASE_VERSION` to 3 and add migration step 3 creating the store with a `status` index. Extend the `applyDatabaseUpgrade` and `openResearchDatabase` specs: a fresh profile reaches version 3, and a version-2 profile with a model and a run keeps them.

## 2. Session model

- [x] 2.1 Add `src/features/researchSession/` with `schemas.ts` (`session.getActive` request; `session.active` response with a nullable `{ id, title, groupId }`), `types.ts` and the barrel.
- [x] 2.2 `createSession`, `getActiveSession`, `endSessionForGroup`, `renameSessionForGroup`, each with a spec on `fake-indexeddb`: a second active session is refused, and two concurrent creates leave exactly one active.
- [x] 2.3 `reconcileActiveSession` with a spec: no session; group gone → ended; title changed → renamed; group present and unchanged → untouched.
- [x] 2.4 `startSession` with a spec: refused without any tab call while a live session is active; a dead session is ended first and the start proceeds; a failed session write closes the group's tab and rethrows.
- [x] 2.5 Extend `TabGroupApi.getGroup` to return the title, and the background entrypoint to supply it.

## 3. Background

- [x] 3.1 `tabGroup.create` runs `startSession` and calls `persistStorage` after a success; add `session.getActive`; add `handleGroupUpdated`, `handleGroupRemoved` (ignoring `isWindowClosing`) and `reconcileSession` to `BackgroundApp`. Extend `app/backgroundApp/index.spec.ts` for each.
- [x] 3.2 Register `tabGroups.onUpdated`, `tabGroups.onRemoved` and `runtime.onStartup` synchronously in `entrypoints/background`, and pass `persistStorage`. Verify with `npm run typecheck`.

## 4. Popup

- [x] 4.1 `PopupApp` asks for the active session on mount, shows it (`session-active`) instead of the form, and switches to it after a successful start. Update its spec.

## 5. End-to-end and spec

- [x] 5.1 Extend the popup snapshot with the active session and whether the form is present; add an e2e scenario: start a session, reopen the popup, see it active with no form; close the group's tab, reopen, see the form.
- [x] 5.2 Amend `RESEARCH_GRAPH_EXTENSION_SPEC.md` (REQ-RT-001, REQ-CAP-004, and the group-removal rule) with the wording from the spike's Findings.
- [x] 5.3 Run `npm run verify` and `openspec validate add-session-store`.
