# Design

## Context

The motivation is in proposal.md (Why). The requirements are in `specs/research-session` and `specs/extension-shell`.

The current state, as of `7bbe614`:

- `sessions` holds the session with its `groupId` and a status of `active` or `saved`.
- The background follows the group:
  - `tabGroups.onUpdated` renames the session;
  - `tabGroups.onRemoved` with `isWindowClosing: false` ends it;
  - `runtime.onStartup` reconciles it.
- Reconciliation ends a session whose group is gone. It runs at start-up, before every start, and when the popup asks.
- The graph store (`nodes`, `edges`) and the job queue exist, but capture is not wired yet. No code follows individual tabs.

The decisions below rest on the spike's Findings, which are kept at the end of this document.

## Goals / Non-Goals

**Goals:**

- A session whose group is removed can come back, on every path where Firefox restores the group.
- A session tab the user restores comes back into the session, even when its group is gone for good.
- Keep everything in the background's database and in browser state that survives a restart, never in memory.

**Non-Goals:**

- Several sessions, a library, or resuming a saved session.
- Restoring a group on the extension's initiative. No WebExtension API can do that (see Findings).
- Re-linking graph nodes to restored tabs. That belongs to the capture change; see Integration.

## Decisions

### A removed group closes the session

`SessionStatus` becomes `active | closed | saved`. `tabGroups.onRemoved` closes the active session whose group it names, whatever `isWindowClosing` says. A closed session keeps its `groupId`.

- **Why not end it, as before?** On removal the extension cannot tell a deleted, saved or emptied group from one that is gone for good. Three of the paths bring the group back under the same id.
- **Why not ignore `isWindowClosing: true`, as before?** A closed window's group becomes a saved group. Treating it like any other removal gives one rule instead of two.

**At most one session is active or closed.** This is the single-session MVP. `createSession` ends a closed session (it becomes `saved`) in the same `readwrite` transaction that checks for an active one and adds the new record. This keeps the invariant atomic, and it means a group restored after a new start cannot revive the old session.

### A returning group reopens its session

`reopenSessionForGroup` makes the closed session active when the group id matches. Three things call it:

- `tabGroups.onCreated`. Firefox announces a restored group first, under its old id.
- `restoreSessionTab`, for a tab created inside the session's group.
- Reconciliation, which also closes an active session whose group is missing.

### Session tabs carry the session's id

`sessions.setTabValue(tabId, "researchSessionId", sessionId)` is set on every tab of the session's group:

- the first tab, right after the start. Its membership event fired before the session was recorded, so it is marked explicitly;
- tabs created inside the group (`tabs.onCreated`);
- tabs moved into the group (`tabs.onUpdated`, filtered to `groupId`).

A marked tab that moves out of the group loses its mark (`removeTabValue`). It is no longer the session's, and restoring it later must not pull it back in.

The value lives in Firefox's session store, so it survives closing and restoring a tab and needs no storage of ours. Reading it needs the `sessions` permission and nothing else.

### A restored session tab returns

`restoreSessionTab` runs on every `tabs.onCreated`. It reads the live session (active, or else closed):

| The new tab                                 | The session's group | Action                                              | Outcome     |
| ------------------------------------------- | ------------------- | --------------------------------------------------- | ----------- |
| is inside the session's group               | —                   | mark it; reopen a closed session                    | `member`    |
| carries no mark of the live session         | —                   | nothing                                             | `ignored`   |
| carries the mark, outside the group         | exists              | `tabs.group({ tabIds, groupId })`; reopen if closed | `joined`    |
| carries the mark, inside a former group     | gone                | `rekeySession` onto that group                      | `adopted`   |
| carries the mark, inside an unrelated group | gone                | nothing                                             | `ignored`   |
| carries the mark, in no group               | gone                | new group with the session's title; `rekeySession`  | `regrouped` |

- `rekeySession` moves the session onto the new group, makes it active, and keeps the id it left in `formerGroupIds`.
- If that former group is restored after all, its tabs arrive with the mark inside a former group while the current group exists. That is the `joined` row: they are moved into the current group, and Firefox removes the emptied former group.
- A group the session left therefore never splits it in two.
- Restoring a tab ends a closed state, which is the user's intent: they are going back to the session.

### Session work is serialized

Every handler that reads the session, asks the browser, and then writes runs through one promise chain in the background app. This covers the browser event handlers, `tabGroup.create`, `session.getActive` and reconciliation.

- **Why:** restoring a closed group, or reopening several closed tabs, produces bursts of events. Run side by side, two restored tabs of a gone group would each find no group and create one. In order, the second finds the group the first created.
- **The chain never rejects,** so one failed handler does not stall the rest.
- **The lock is held in memory, and only for the length of one handler.** An event page that unloads loses nothing durable.

### Listeners

The background entrypoint registers, synchronously and before any `await`:

- `tabGroups.onCreated`;
- `tabs.onCreated`;
- `tabs.onUpdated` with the filter `{ properties: ["groupId"] }`. Firefox 157 lists `groupId` among the filter properties, so the event page is not woken for every page load.

The shared typings, written for Chrome, declare neither the filter argument nor the `sessions` tab-value calls. The entrypoint therefore types them with two small interfaces, as it already did for `removeInfo`.

### Popup

`session.active` gains `closedSession`. With no active session and a closed one, the popup shows the form and, above it, `Session “<title>” is closed. Restore its group or one of its tabs to go on with it; starting a new session ends it.` (`data-testid="session-closed"`).

### Migration

Step 6 rewrites every stored session that lacks `formerGroupIds`, giving it an empty list. It runs inside the version-change transaction. No index changes; `closed` is served by the existing `status` index.

### Integration with the graph and capture

Nothing here touches `nodes` or `edges`. Two things are prepared for the capture change:

- **Membership.** A tab's membership in the session is the group, as before. The mark and the three tab handlers are the place to hang capture start and stop on.
- **Restored tabs.** A restored tab has a new tab id, while `StoredNode.tabId` still holds the old one. The capture change can add a second per-tab value (the node id) through the same `SessionTabApi`, read it in `restoreSessionTab`'s `tabs.onCreated` path, and re-link the open node. The `sessionTab` index already finds nodes by `(sessionId, tabId)`.

### Tests

- **Unit:** every model function is tested against `fake-indexeddb` and a stub `SessionTabApi`. The background app spec covers the event handlers, including two tabs restored at once ending in one group.
- **End-to-end** (`e2e/specs/sessionRestore.e2e.ts`): drives the real extension through Firefox's own close and restore paths, running in the chrome context:
  1. deleting the group closes the session, and Ctrl+Shift+T reopens it;
  2. closing the group's tabs one by one, then Ctrl+Shift+T, brings the tab back in a group titled after the session, and the session is active;
  3. starting a session while one is closed ends it, and restoring its group does not revive it.

  Each close runs after a tab-state flush; see Findings, "Saved groups".

## Risks / Trade-offs

- **The extension creates a group the user did not ask for.** This is the `regrouped` row. → It happens only for a tab carrying the live session's mark, and that mark is cleared when the user moves the tab out. A tab restored from an ended session is left alone.
- **Firefox chooses the colour of a recreated group.** It may not be the session's old colour. → Acceptable for the MVP. `tabGroups.update` can copy a stored colour later if that matters.
- **A closed session can stay closed for ever.** → It blocks nothing: the next start ends it. The popup names it so the user knows it is there.
- **`removeTabValue` needs the tab to still be open.** A tab removed together with its group keeps its mark, which is the point: it is still the session's.
- **The e2e fixture relies on Firefox internals:** `SessionWindowUI`, `TabStateFlusher` (whose module path has moved before), `gBrowser.removeTabGroup` and `addTrustedTab`. → They are kept inside `e2e/fixtures/sessionRestore/`. The product uses only `tabs`, `tabGroups` and `sessions`.

## Open questions

- **A restart between closing and restoring. Not observed.**
  - From the source: saved groups are part of the persisted state, and closed groups and closed tabs persist across sessions (`browser.sessionstore.persist_closed_tabs_between_sessions` is `true`). So the ids and the marks should survive a restart.
  - Not checked by hand. It needs a regular profile with session restore on: start a session, close it in each of the ways in the Findings table, restart, restore, and check that the popup shows the session active.
- **History › Recently closed and the tab overflow menu. Not clicked through the UI.** They call the same `SessionStore.undoCloseTabGroup` / `openSavedTabGroup` / `undoCloseById` entry points the spike used _(source)_.

## Spike method

The findings below come from a spike run on this branch before it became this change.

- **The extension's view.** An unlisted extension page logged every tab and tab-group event the extension hears, with its payload. It also exposed `tabs.group`, `tabGroups.*` and `sessions.*`.
- **The user's actions.** A WebdriverIO spec drove the tab strip from the chrome context, through the same entry points the UI uses:
  - `gBrowser.removeTab` (the tab's ✕, Ctrl+W);
  - `gBrowser.removeTabs` (closing a multi-selection);
  - `gBrowser.removeTabGroup` ("Delete group");
  - `group.saveAndClose()` ("Save and close group");
  - `SessionWindowUI.undoCloseTab` (Ctrl+Shift+T);
  - `SessionStore.openSavedTabGroup` (reopening from the tab overflow menu).
- **Firefox's own record** of what it could restore came from `SessionStore.getClosedTabGroups()`, `getSavedTabGroups()` and `getClosedTabData(window)`.
- **Real pages.** Tabs loaded `http://127.0.0.1:<port>/…` from a local server, because Firefox does not keep a closed `about:blank` tab.
- **Where the explanations come from.** Explanations marked _(source)_ were read in Firefox 157's own source (`Tabbrowser.sys.mjs`, `SessionStore.sys.mjs`, `tabgroup.mjs`, `ext-tabGroups.js`, `ext-tabs.js` in `omni.ja`).

## Findings (spike)

Observed in Firefox 157.0.1 on macOS, headless, through the WebdriverIO harness, from a temporary probe page and a characterization spec. Both were removed when the spike became this change. The method is described under Spike method below.

### Group ids

- **A restored group keeps its id on every path that restores it.** That covers undo-close, the saved list, and a group closed with its window. Its title and colour are kept as well.
- **The id is the same number in both worlds, written differently.** Firefox writes it as `"<ms>-<n>"`, and the extension sees `<ms>` followed by `<n>` padded to three digits:

  | Firefox writes     | The extension sees |
  | ------------------ | ------------------ |
  | `1791789483894-30` | `1791789483894030` |
  | `1791789196531-9`  | `1791789196531009` |

  The group's state carries this id, which is why it survives a restore _(source)_.

### Closing a group: what Firefox keeps

The way a group was closed decides whether it can come back at all.

| How the group was closed                                               | What Firefox keeps                      | Comes back with its id                           |
| ---------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------ |
| Its last tab closed (✕, Ctrl+W, `tabs.remove` of one tab)              | Loose closed tabs, no group             | **Never.** The tabs come back ungrouped          |
| Its tabs closed one at a time                                          | Loose closed tabs, no group             | **Never**                                        |
| All its tabs closed in one action (multi-select, `tabs.remove` of all) | A **saved** group                       | Yes: Ctrl+Shift+T, or the saved list             |
| "Delete group"                                                         | A **closed** group (Recently closed)    | Yes: Ctrl+Shift+T, or History › Recently closed  |
| "Save and close group"                                                 | A **saved** group                       | Yes: the saved list, or Ctrl+Shift+T right after |
| Its window closed                                                      | A **saved** group (and a closed window) | Yes: the saved list                              |

- **Closing all of a group's tabs together saves the group.** `removeTabs` looks for groups that the selection empties completely, and for each one calls `group.save()` and then `removeTabGroup` _(source)_. `tabs.remove` with every id of a group takes this path. `tabs.remove` with one id goes through `removeTab`, which never saves a group _(source, and observed)_.
- **A single tab's removal never records the group.** Its closed-tab entry has `closedInTabGroupId: null`. Nothing remembers that the tab was in a group, so neither undo nor `sessions.restore` can put it back.

### What the extension hears

- **Every path fires the same events.** First `tabs.onRemoved` for each tab, then `tabGroups.onRemoved` with `{ isWindowClosing: false }`. A closed window is the one exception, with `{ isWindowClosing: true }`.
- **A saved group cannot be told from a deleted one.** The extension cannot distinguish "saved", "deleted" and "gone for good" from the event. `sessions.getRecentlyClosed` does not help either: it lists no groups, and its tab entries carry no `groupId`.
- **A restore announces the group first.** `tabGroups.onCreated` arrives with the old id, title and colour. Then `tabs.onCreated` arrives for each tab, already carrying that `groupId`.
  - Every tab except the selected one comes back discarded (`discarded: true`) and loads when it is first shown.
  - No `tabs.onUpdated` with a `groupId` change follows, because the tabs never leave the group.

### Saved groups, and why `spike-tab-groups` could not reproduce them

- Firefox builds a saved group from the parent process's cached state of each tab. A group with no tab worth saving is silently not saved _(source: `#recordSavedTabGroupState` returns when `tabs` is empty)_.
- **In a freshly loaded tab that cache can still be empty.** Then "Save and close" removes the group from the strip, saves nothing, and the group lands among the closed groups instead. That is why `getSavedTabGroups()` stayed empty in `spike-tab-groups`.
- Flushing the window first (`TabStateFlusher.flushWindow`) makes "Save and close" behave as it does for a person, whose tabs were collected long before they close the group.
- **A reopened saved group keeps its id.** This answers the open question left by `spike-tab-groups`.

### Restoring a closed tab into a live session

- **A tab closed from a group that is still open comes back into that group.** Ctrl+Shift+T and `sessions.restore()` both do this. `tabs.onCreated` already reports the group's `groupId`.

### Restoring a tab after its group is gone

- **When the group is gone for good** (its last tab closed, or its tabs closed one by one), its tabs come back ungrouped (`groupId: -1`). `tabGroups.get(oldId)` rejects with `No group with id: <id>`, and `tabs.group({ groupId: oldId })` rejects in the same way. The old id cannot be reused.
- **When the group is closed or saved,** Ctrl+Shift+T restores the whole group. `sessions.restore()` does not:
  - with no id, it restores the single most recently closed tab, ungrouped;
  - with one tab's `sessionId`, it restores that tab ungrouped. The closed group stays restorable, one tab smaller. Once its last tab has been taken out this way, Firefox drops the closed group _(source: `#cleanupOrphanedClosedGroups`)_.
- **A stray tab can be put back into the session.**
  - Once the group is back (`undoCloseTabGroup`), `tabs.group({ tabIds, groupId })` adds the stray tab to it.
  - If the group is gone for good, `tabs.group({ tabIds })` creates a new group for it, under a new id. A further tab joins that new group by id.
- **The extension has no way to reopen a closed or saved group itself.** There is no WebExtension API for undo-closing a group or opening a saved one, and `sessions.restore` brings back tabs only. The user brings a group back; the extension can only notice that it came back.

### Marking a tab as the session's

- **`sessions.setTabValue` survives every restore observed:** a single tab into a live group, a whole group by undo, a saved group reopened, a group closed with its window, and a tab restored ungrouped.
- **The value is already readable inside `tabs.onCreated`.** The probe page read the mark with `getTabValue` from the listener of the restored tab's own `onCreated`.
- So a restored tab can be recognised as the session's even when Firefox has forgotten its group.

### Permissions

- **`sessions` is required for `setTabValue`, `getTabValue`, `getRecentlyClosed` and `restore`.** Without it, `browser.sessions` is `undefined`. It adds no host access and no network behaviour.
- **`tabs` is still not needed.** Without it, a `getRecentlyClosed` entry has no `url` and no `title`. The design here does not need either.
