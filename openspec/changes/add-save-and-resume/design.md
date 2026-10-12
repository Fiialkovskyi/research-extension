# Design

## Context

- **Session statuses** are `active`, `closed` and `saved`.
  - `createSession` ends a closed session as `saved`, and `startSession` creates a group through `tabGroups/createTabGroup` (`TabGroupApi`: `createTab`, `groupTabs`, `updateGroup`, `getGroup`, `activateTab`, `removeTab`).
  - `closeSessionForGroup` closes only the active session following that group.
  - `reopenSessionForGroup` reopens a closed session whose group returns.
- **Capture.**
  - `recordNavigation` records a node per committed top-frame page and closes the tab's previous node. It skips reloads only by `transitionType`.
  - `followTabMembership` records a node for a tab joining the group, unless the tab already has an open node.
  - All capture runs on one serial queue.
- **Signals.** Page observers flush on `pagehide`. A batch arriving after the session is no longer active is dropped (`readSignalTarget` → `stop`), so closing tabs before flushing would lose the last seconds of scroll and copies.
- **Dwell.** `trackActiveDwell` settles reading time against `StoredSession.focus`, written by `setSessionFocus`.
- **The popup** shows the session form, or the active session, through one-shot `session.getActive`.

## Goals / Non-Goals

**Goals:**

- Save loses nothing the session recorded, and leaves the window usable.
- Resume reopens the same nodes, so the graph, clusters, snapshots and vectors carry over unchanged.
- Nothing is fetched for a resumed tab until the user looks at it.

**Non-Goals:**

- STO-006 reattach suggestions, and export or import.
- Per-tab scroll restoration: Firefox restores nothing for a new discarded tab, and only "left off at" is promised.

## Decisions

### Saving: flush, then one capture-queue step, then close

`session.save` in `app/backgroundApp`:

1. **Flush.** For each open node's tab it calls `pageSignals.requestFlush(tabId)`, which is `tabs.sendMessage(content.flush)` to frame 0. It waits for all of them, each capped at 1 s, and swallows failures, because a tab without an observer has nothing to send. `observePage` answers `content.flush` by flushing and resolving once its batch has been sent. Those batches land on the capture queue before the next step.
2. **Save.** Then, on the capture queue:
   1. `trackActiveDwell({ focusedTabId: undefined })`;
   2. `researchLibrary/saveActiveSession({ database, api: { queryGroupTabs }, now })`.

   `saveActiveSession` reads the group's tabs in index order and maps each to its open node. In one transaction it writes:
   - `savedTabs: { nodeId, url, title }[]`;
   - `lastPosition: { nodeId, title, readFraction }`, taken from `focus.nodeId`, else the node with the latest `lastFocusedAt`, with `readFraction` its `maxScroll`;
   - `savedAt`;
   - `status: "saved"`;
   - every open node closed.

   It returns the tab ids.

3. **Close.** It calls `closeTabsKeepingWindow(api, tabIds)`. If those tabs are every tab of their window, it opens one new tab there first, then removes them. The group goes with its last tab, and `handleGroupRemoved` finds no active session to close.

**Why the session is saved before its tabs close.** Closing tabs first would close the session (`closed`), and its `pagehide` batches would race the save.

### The library

`listSavedSessions(database)` returns the saved sessions with `savedAt` (falling back to `updatedAt`), page count by the `sessionId` node index, and `lastPosition`, newest first.

The popup shows it below the start form when no session is active. Delete uses `recordedData/ui/confirmDelete` and the existing `session.delete`.

### Resuming

`researchLibrary/resumeSession({ database, sessionId, api })` runs on the capture queue:

1. It reconciles, refuses if a session is active, and ends a closed one as `saved`, as `createSession` does.
2. It creates the saved tabs in order through `api.createTab({ url, active, discarded, title })`. The left-off tab is active and loaded; every other tab is `discarded: true` with its title. A session with no saved tabs gets one new-tab page.
3. It groups them, titles the group, and selects the left-off tab.
4. In one transaction:
   - the session becomes `active`, with `groupId` the new group and the old one appended to `formerGroupIds`;
   - each saved node gets its new `tabId` and `tabState: "open"`.
5. If any step throws, the tabs it opened are removed.

The membership events the new tabs raise are handled on the same queue after this step, so they find each tab's node already open and record nothing.

`ResumeApi` extends `TabGroupApi`'s calls with `createTab` taking `url`, `discarded` and `title`.

### A same-URL commit is not a new page

`recordNavigation` treats a commit whose URL equals the tab's current open node's URL (ignoring the fragment) as a reload. That covers a discarded tab loading on selection, whatever `transitionType` Firefox reports for it, and a link to the page already shown.

### "You left off at"

- **The summary.** `session.active`'s summary gains `lastPosition: { title, readFraction } | null`, and the popup shows "You left off at <title> (<n>% read)".
- **Clearing it.** `trackActiveDwell` clears `lastPosition` when a visit starts on a node other than `lastPosition.nodeId`. `setSessionFocus` gains a `clearLastPosition` flag for this.

## Risks / Trade-offs

- **[`discarded` tabs and `tabs.group`]** → Firefox supports both since 140. If it refused to group a discarded tab, resume would fail, and remove what it opened. The e2e covers it.
- **[A flush that never answers]** → Each is capped at 1 s, and saving goes on without it.
- **[Treating same-URL commits as reloads hides a deliberate re-navigation to the same page]** → It is the same page; nothing is lost but a duplicate node.

## Findings

- **The e2e harness moves the user on.** Its database reader finds its tab by switching through every tab, which selects the session's other pages. That is a real move to another page, so "You left off at …" clears, as specified. The e2e reads the popup right after resuming, before any database read.
- **`discarded` is not asserted end to end.** The suite's tab reader reports URL, selection and group, not whether a tab is loaded. The unit specs assert that every tab but the left-off one is created with `discarded: true`. The e2e asserts the tabs, their order, the selected one and that no node was recorded again.

## Migration Plan

- **Storage.** The optional `StoredSession` fields need no migration.
