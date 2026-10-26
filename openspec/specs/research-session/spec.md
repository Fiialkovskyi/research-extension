# research-session Specification

## Purpose

Defines how a research session is started and which tabs belong to it. A session is a Firefox tab group, so its tabs are the group's tabs and its name is the group's title.

## Requirements

### Requirement: User starts a session as a named tab group

The popup SHALL let the user enter a title and submit it. On submit, the extension SHALL create one new tab group with that title in the current window, holding exactly one new tab that shows the browser's new-tab page, and SHALL move focus to that tab. The extension SHALL NOT choose the group's colour; it SHALL use the colour the browser assigns.

#### Scenario: User submits a title

- **WHEN** the user enters `E-bike motors` in the popup and submits it
- **THEN** the current window contains a new tab group titled `E-bike motors`
- **AND** that group holds exactly one tab, which shows the new-tab page and has focus
- **AND** the group has one of the browser's tab group colours

#### Scenario: Title is blank

- **WHEN** the popup's title input is empty or contains only whitespace
- **THEN** the user cannot submit it
- **AND** no tab or tab group is created

#### Scenario: Surrounding whitespace is dropped

- **WHEN** the user submits `  E-bike motors  `
- **THEN** the new group's title is `E-bike motors`

### Requirement: A failed start leaves nothing behind

IF creating the group or setting its title fails, THEN the extension SHALL close the tab it opened for that attempt and SHALL report the failure to the popup when the popup is still open.

#### Scenario: Grouping the new tab fails

- **WHEN** the browser refuses to put the new tab into a group
- **THEN** that tab is closed
- **AND** no new group remains in the window
- **AND** if the popup is still open, it shows the reason

### Requirement: Several sessions may be active

The extension SHALL record each started session in its database, with the id of its tab group. Any number of sessions MAY be active at the same time, each following its own group, and a start SHALL NOT be refused because another session is active, closed or saved. WHEN the user submits a title that another live session already uses, the extension SHALL start the session anyway. The write that records a start SHALL either record the session or leave nothing behind, even when two starts are requested at the same time.

#### Scenario: Starting while a session is active

- **GIVEN** the session `E-bike motors` is active and its group still exists
- **WHEN** a start is requested with the title `Batteries`
- **THEN** a tab group `Batteries` is created
- **AND** both `E-bike motors` and `Batteries` are active

#### Scenario: Two starts at once

- **WHEN** two starts are requested at the same time
- **THEN** two sessions become active, each with its own group

#### Scenario: Recording the session fails

- **WHEN** the group is created but the session cannot be recorded
- **THEN** the group's tab is closed
- **AND** the popup, if still open, shows the reason

#### Scenario: Starting while a session is closed

- **GIVEN** the session `E-bike motors` is closed
- **WHEN** the user starts the session `Batteries`
- **THEN** `Batteries` is active
- **AND** `E-bike motors` is still closed, and restoring its group makes it active again

### Requirement: The session survives a restart

The active session SHALL be kept in the database, not in memory. After the background unloads or the browser restarts, the extension SHALL treat the same session as active as long as a tab group with its recorded id exists. A session whose group does not exist SHALL be closed, not ended, and SHALL become active again once a group with its recorded id exists.

#### Scenario: Browser restart with session restore

- **GIVEN** the session `E-bike motors` is active
- **WHEN** Firefox is restarted and restores the group
- **THEN** `E-bike motors` is still the active session, with the same group id

#### Scenario: Group gone after a restart

- **GIVEN** the session `E-bike motors` is active
- **WHEN** the browser starts and no group with the session's id exists
- **THEN** the session is closed, not active and not ended

### Requirement: The session follows its group

WHEN the session's group is renamed, the session's title SHALL change to match. WHEN the session's group is removed, by any path and whether or not its window is closing, the session SHALL be closed: not active, not ended, and still recording the group's id. The extension SHALL NOT end a session because its group was removed, because Firefox reports a deleted, saved, or emptied group the same way and restores several of them under the same id.

#### Scenario: Group renamed

- **WHEN** the user renames the session's group to `Mid-drive motors`
- **THEN** the session's title is `Mid-drive motors`

#### Scenario: Last tab closed

- **WHEN** the user closes the last tab of the session's group
- **THEN** no session is active
- **AND** the session is closed, with the group's id

#### Scenario: Group deleted or saved and closed

- **WHEN** the user deletes the session's group, or saves and closes it
- **THEN** the session is closed, with the group's id

#### Scenario: Window closes

- **WHEN** the window holding the session's group closes
- **THEN** the session is closed, with the group's id

### Requirement: The popup shows the viewed session

WHEN the popup opens, it SHALL show a select over the user's sessions: the live ones first, then the saved ones, with the viewed session chosen, and a button to start a new session that is always available. For the viewed live session it SHALL show its title and the number of pages recorded. WHEN no session is live, it SHALL offer the title form. Before deciding, the extension SHALL close every recorded active session whose group no longer exists, and SHALL reopen every closed session whose group exists again.

#### Scenario: Popup opened during a session

- **GIVEN** the sessions `E-bike motors` (2 pages) and `Batteries` (5 pages) are active, and `Batteries` is viewed
- **WHEN** the user opens the popup
- **THEN** the select lists both and shows `Batteries`, with 5 pages recorded
- **AND** the button to start a new session is enabled

#### Scenario: Popup opened after the group was closed

- **GIVEN** the only session's group was removed
- **WHEN** the user opens the popup
- **THEN** the popup offers the title form
- **AND** the select lists the closed session among the saved ones

#### Scenario: Choosing another session in the select

- **GIVEN** two active sessions
- **WHEN** the user chooses the other one in the select
- **THEN** the popup shows that session, and no tab or group is opened or closed

### Requirement: A returning group reopens its session

WHEN a tab group appears whose id is the closed session's group id, the extension SHALL make that session active again.

#### Scenario: User undoes deleting the group

- **GIVEN** the user deleted the session's group
- **WHEN** the user presses Ctrl+Shift+T
- **THEN** the group comes back under the same id
- **AND** the session is active again

#### Scenario: User reopens a saved group

- **GIVEN** the user saved and closed the session's group
- **WHEN** the user reopens it from Firefox's saved groups
- **THEN** the session is active again

### Requirement: Session tabs carry the session's id

The extension SHALL record the session's id on every tab in the session's group, as a per-tab session value that the browser keeps when the tab is closed and restores with it. It SHALL clear that value from a tab that leaves the session's group while the tab is open.

#### Scenario: A tab joins the session's group

- **WHEN** a tab is created in, or moved into, the session's group
- **THEN** the tab carries the session's id

#### Scenario: A tab is moved out of the group

- **WHEN** the user drags a session tab out of the session's group
- **THEN** the tab no longer carries the session's id
- **AND** restoring it after it is closed does not bring it into the session

### Requirement: A restored session tab returns to its session

WHEN a tab is created that carries the id of the active or closed session and is outside that session's group:

- if the session's group exists, the extension SHALL add the tab to it;
- otherwise, if the tab is inside one of the session's former groups, the session SHALL follow that group again;
- otherwise, if the tab is in no group, the extension SHALL create a group with the session's title for it, SHALL record that group's id as the session's group id, and SHALL keep the previous id as a former group id.

In each case the session SHALL be active afterwards. A tab carrying the id of an ended session SHALL be left where it is.

#### Scenario: Tab restored while the group is open

- **GIVEN** the session's group is open
- **WHEN** the user restores a tab that was closed from it
- **THEN** the tab is in the session's group

#### Scenario: Tab restored after the group is gone for good

- **GIVEN** the session's group was removed by closing its tabs one by one
- **WHEN** the user restores one of those tabs
- **THEN** the tab is in a group titled with the session's title
- **AND** the session follows that group and is active

#### Scenario: Several tabs restored at once

- **GIVEN** the session's group is gone for good
- **WHEN** two of its tabs are restored together
- **THEN** both are in one group titled with the session's title

### Requirement: A returning former group is merged into the session's group

WHEN a tab is created inside one of the session's former groups while the session's current group exists, the extension SHALL move that tab into the session's current group.

#### Scenario: User restores a group after one of its tabs was restored on its own

- **GIVEN** one tab of the deleted session group was restored on its own and given a new group
- **WHEN** the user then restores the deleted group
- **THEN** its tabs end up in the session's current group

### Requirement: Starting a session asks for page access

WHEN the user submits a session title and the extension does not yet have access to page contents, it SHALL ask the browser for it as part of the same click. The session SHALL start whether access is granted, refused or left unanswered. WHEN the extension already has page access, the browser SHALL NOT be asked again.

#### Scenario: First session

- **GIVEN** the extension has never been granted page access
- **WHEN** the user submits `E-bike motors`
- **THEN** the browser asks the user to allow access to page contents
- **AND** the session `E-bike motors` starts

#### Scenario: Access refused

- **WHEN** the user refuses page access while starting a session
- **THEN** the session is active all the same

### Requirement: The popup says when page access is missing

WHEN a session is active and page access has not been granted, the popup SHALL say that reading and scrolling are not being recorded, and SHALL offer a control that asks for page access again. WHEN access is granted, the popup SHALL NOT show either.

#### Scenario: Popup without page access

- **GIVEN** a session is active and page access was refused
- **WHEN** the user opens the popup
- **THEN** it says reading and scrolling are not being recorded
- **AND** it offers to allow page access

#### Scenario: Popup with page access

- **GIVEN** a session is active and page access was granted
- **WHEN** the user opens the popup
- **THEN** it shows no page-access notice
