# Proposal

## Why

The spike `spike-tab-groups` showed that a research session can be a Firefox tab group, and that the group keeps its id across a browser restart. But the extension still forgets the session the moment the background event page unloads: nothing records which group is the session. Session restore is a firm requirement, and until after the MVP there is exactly one session at a time. Both need the session to live in the database, which is the extension's only source of truth (REQ-RT-004).

This is the first of three database changes planned for the MVP: sessions (this change, database version 3), the graph (`nodes`, `edges`, version 4) and the job queue (`jobs`, version 5).

## What Changes

- **A `sessions` store** joins the `research-graph` database in migration step 3. A session record holds its id, title, the `groupId` of its tab group, its status (`active` or `saved`) and timestamps.
- **At most one session is active.** Starting one while another is active is refused. The check runs inside the same transaction that writes the new session, so two concurrent starts cannot both succeed.
- **Starting a session records it.** The popup's existing `tabGroup.create` request now also writes the session after the group exists. If that write fails, the group's tab is closed, so no untracked group is left behind.
- **The session follows its group:**
  - renaming the group renames the session;
  - when the group is removed (its last tab closed, or it was saved and closed in Firefox), the session ends and is kept as `saved`;
  - a removal caused by the window closing does not end it, because session restore brings the group back.
- **The session is reconciled with the browser** on browser start-up, before a new session starts, and when a surface asks for the active session. A session whose group no longer exists ends; a title changed while the extension was not listening is picked up.
- **The popup shows the active session** instead of the form, via a new `session.getActive` request.
- **Storage is made persistent** (`navigator.storage.persist()`) when a session starts (REQ-STO-009), so the browser does not evict research data under storage pressure.
- **`RESEARCH_GRAPH_EXTENSION_SPEC.md` is amended** with the REQ-RT-001 and REQ-CAP-004 wording proposed in the spike's Findings, plus a requirement that ending the group ends the session.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `research-session`: adds the single active session, its persistence across restarts, following the group's title and removal, and showing the active session in the popup.

## Impact

- **New code:** `src/features/researchSession/` (schemas, `createSession`, `getActiveSession`, `endSessionForGroup`, `renameSessionForGroup`, `reconcileActiveSession`, `startSession`).
- **Modified code:**
  - `src/shared/storage`: `SESSION_STORE`, `StoredSession`, migration step 3, `DATABASE_VERSION = 3`;
  - `src/features/tabGroups`: `TabGroupApi.getGroup` also returns the title;
  - `src/app/backgroundApp`: `tabGroup.create` starts a session, `session.getActive`, and three new entry points for browser events;
  - `src/entrypoints/background`: registers `tabGroups.onRemoved`, `tabGroups.onUpdated` and `runtime.onStartup` synchronously;
  - `src/app/popupApp`: reads the active session on mount;
  - e2e popup snapshot and a new e2e scenario.
- **Permissions:** none added.
- **Out of scope:**
  - reattaching a group reopened from Firefox's saved groups. Whether such a group keeps its id has not been checked by hand yet (see design.md);
  - pausing, the library, resume and deletion (STO-003 to STO-005, STO-008);
  - the graph and the job queue, which are the next two changes;
  - renaming the `tabGroup.create` message to the spec's `session.start`.
