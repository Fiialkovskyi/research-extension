# Proposal

## Why

A session lasts exactly as long as its tab group. Research rarely fits one sitting: the user needs
to put it aside, keeping the record and freeing the tabs, and to come back to where they stopped.
REQ-STO-003 to REQ-STO-005 (M3) define that: save, a library of saved sessions, and a lazy resume
that says where the user left off. Everything a saved session holds is already recorded, encrypted
and deletable, so saving it is now a matter of closing it deliberately.

## What Changes

- **"Save research"** in the popup, while a session is active:
  1. The open pages' observers are asked to send what they hold, and reading time is settled.
  2. The page the user was on is recorded as "left off at", with how far it was read.
  3. The session's tabs are kept in order: URL, title and node.
  4. The session's nodes are closed, it becomes `saved`, and its tabs are closed. A new tab is opened
     first if they were the window's only tabs, so the window stays.

  This finishes in under 2 s for 100 pages.

- **The library.** When no session is active, the popup lists saved sessions, newest first, each with
  its title, when it was saved, its page count and where it was left off. Each has "Resume" and a
  confirmed "Delete", which uses the existing cascade.
- **"Resume"** recreates the session's tab group, titled as before, with its tabs in their saved
  order:
  - every tab but the left-off page opens unloaded (`discarded`), so nothing is fetched until it is
    shown;
  - the left-off page opens loaded and selected;
  - the saved nodes are reopened on the new tabs, rather than recorded again;
  - the session becomes active again, with the old group among its former groups.

  Resuming is refused while another session is active, and ends a closed one as starting does.

- **"You left off at <title> (<n>% read)"** is shown in the popup after a resume, until the user moves
  on to another page.
- **No duplicate nodes on load.** A commit of the URL a session tab's current page already has records
  no new node. That is how an unloaded tab loading when selected stays one node.

## Capabilities

### New Capabilities

- `research-library`: saving a session, the library of saved sessions, and resuming one.

### Modified Capabilities

- `research-graph`: a commit of the tab's current URL is not a new page.

## Impact

- **New code:** `features/researchLibrary/`:
  - `saveActiveSession`, `listSavedSessions`, `resumeSession`, `closeTabsKeepingWindow`;
  - UI: the library list.
- **Changed code:**
  - `pageSignals/observePage` answers `content.flush`;
  - `tabCapture/recordNavigation` skips same-URL commits, and `trackActiveDwell` clears "left off at"
    on moving on;
  - `app/backgroundApp` handles `session.save`, `library.list` and `session.resume`;
  - the popup gains Save, the library, and the left-off line;
  - `session.active` carries the left-off position.
- **Storage:** `StoredSession` gains the optional `savedTabs`, `lastPosition` and `savedAt`, so there
  is no migration.
- **Out of scope:**
  - suggesting a saved session to reattach (STO-006);
  - export and import;
  - keeping scroll positions per tab beyond "left off at".
