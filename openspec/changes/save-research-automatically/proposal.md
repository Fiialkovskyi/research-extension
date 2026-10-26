# Proposal

## Why

A session is only kept for the library when the user presses "Save research" in the popup. A user
who closes the group, closes the window or quits Firefox without pressing it gets a session the
library does not list and cannot resume; the button is a step people forget, and research is
something one expects to be kept without asking.

## What Changes

- **The "Save research" button goes**, with the `session.save` request behind it. Nothing closes a
  session's tabs on the extension's initiative any more.
- **A session is saved as the user goes.** While a session is active, the background records its
  group's tabs, in order with the page each shows, a moment after capture goes quiet (1 s, never
  more than 5 s after the first change). An emptied group is never recorded, so closing a group
  keeps the tabs it held.
- **Closing a session saves where the user left off.** When its group is removed, by any path, the
  page in focus (or else the one focused last) is recorded with how far it was read, and the time.
- **The library lists closed sessions too**, newest first, and **resumes them** like saved ones. A
  closed session still comes back by itself when its group or one of its tabs is restored; starting
  a new session still ends it as saved.
- The popup's line for a closed session says it is saved and can be resumed below.

Out of scope: several open sessions at once (deferred until after the MVP), and dropping the
page observer's on-demand flush, which nothing asks for now but which costs nothing to keep.

## Capabilities

### Modified Capabilities

- `research-library`: saving is automatic; the library lists and resumes closed sessions.
- `research-session`: the popup's wording for a closed session.

## Impact

- `features/researchLibrary`: `saveActiveSession` becomes `recordSessionTabs`, which records tabs
  only; `closeTabsKeepingWindow` and `SAVE_FLUSH_TIMEOUT_MS` go; `listSavedSessions` and
  `resumeSession` accept closed sessions; resuming closes pages a closed window left open.
- `features/researchSession`: `closeSessionForGroup` records the left-off page and `savedAt`.
- `app/backgroundApp`: the `session.save` handler and the `closeTabs` dependency go; a debounced
  record of the tabs is armed by every capture event.
- `app/popupApp`: the button and its handler go.
- e2e: saving is done by closing the group; the database snapshot reads how many tabs are saved.
