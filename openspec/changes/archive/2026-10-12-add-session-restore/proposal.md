# Proposal

## Why

A research session is one Firefox tab group, recorded with the group's id (`add-session-store`). Today the session **ends** as soon as its group is removed, unless the window is closing. Restoring the group afterwards does not bring the session back, and neither does restoring one of its tabs. Session restore is a firm requirement, and three cases fall through it:

1. **A closed session should come back.** The user deletes the group, saves and closes it, or closes its window, and then restores it.
2. **A closed tab should come back into the session.** The user closes a tab of the session and restores it with Ctrl+Shift+T.
3. **A tab should come back after its group is gone.** The group went away for good, for example because its last tab was closed, and the user then restores one of its tabs.

A spike measured how Firefox 157 behaves in each case. Its findings are in design.md. Three of them shape this change:

- A restored group keeps its id.
- The extension cannot tell a deleted, saved or emptied group from one that is gone for good.
- A per-tab session value survives every way a tab is restored, and the extension can read it as soon as the tab appears.

## What Changes

- **A session can be closed.** Removing the session's group no longer ends the session. The session is _closed_: it is not active, but it keeps its group id. A new `closed` status sits between `active` and `saved`.
- **A returning group reopens its session.** This applies when `tabGroups.onCreated` reports the closed session's group id, and also to reconciliation (start-up, before a start, when the popup asks).
- **Session tabs are marked.** Every tab in the session's group carries the session's id as a per-tab session value (`sessions.setTabValue`). A tab dragged out of the group loses the mark.
- **A restored session tab finds its way back:**
  - into the session's group, when that group exists;
  - into a former group of the session, which the session then follows again;
  - or into a new group titled after the session, which the session then follows. The old id is kept in `formerGroupIds`.
- **Session work runs in order.** Browser events about the session are handled one at a time, so two tabs restored together end up in one new group, not two.
- **Starting a session ends a closed one**, in the same transaction, so a group restored later cannot revive it.
- **The popup names a closed session** beside the form, and says that starting a new session ends it.
- **The manifest declares `sessions`.**
- **Database version 6:** existing sessions get an empty `formerGroupIds`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `research-session`:
  - removal closes the session instead of ending it;
  - a returning group reopens it;
  - session tabs carry the session's id, and restored tabs return to the session;
  - starting a session ends a closed one;
  - the popup names the closed session.
- `extension-shell`: the manifest also declares `sessions`.

## Impact

- **Code:**
  - `src/shared/storage`: `SessionStatus` gains `closed`, `StoredSession` gains `formerGroupIds`, and migration step 6 is added.
  - `src/features/researchSession`:
    - new: `closeSessionForGroup`, `reopenSessionForGroup`, `rekeySession`, `getLiveSession`, `restoreSessionTab`, `trackSessionTabMembership`, `SessionTabApi`;
    - removed: `endSessionForGroup`;
    - changed: `createSession` and `reconcileActiveSession`;
    - `session.active` gains `closedSession`.
  - `src/app/backgroundApp`:
    - a `sessionTabs` dependency;
    - new handlers `handleGroupCreated`, `handleTabCreated` and `handleTabGroupChanged`;
    - `handleGroupRemoved` no longer takes `removeInfo`;
    - session work is serialized.
  - `src/entrypoints/background`: registers `tabGroups.onCreated`, `tabs.onCreated`, and `tabs.onUpdated` filtered to `groupId`.
  - `src/app/popupApp`: shows the closed session.
  - `wxt.config.ts`: declares `sessions`.
  - e2e: a `sessionRestore` fixture and spec, and the closed session in the popup snapshot.
- **Permissions:** `sessions` is added. It grants no host access and no network behaviour. `tabs` is still not requested.
- **Graph (prepared for, not implemented):** a restored tab gets a new tab id, while `StoredNode.tabId` holds the old one. The capture change can re-link the two through the same per-tab value mechanism (see design.md).
- **Out of scope:**
  - several sessions at once;
  - a library, or the user resuming a saved session;
  - re-linking graph nodes to restored tabs;
  - a manual check across a browser restart (see design.md, Open questions).
