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

### Requirement: At most one session is active

The extension SHALL record each started session in its database, with the id of its tab group. At most one session SHALL be active at a time. WHEN the user submits a title while a session is active, the extension SHALL refuse the start, SHALL NOT create a tab or tab group, and SHALL report which session is active. The check SHALL hold even when two starts are requested at the same time.

#### Scenario: Starting while a session is active

- **GIVEN** the session `E-bike motors` is active and its group still exists
- **WHEN** a start is requested with the title `Batteries`
- **THEN** no tab or tab group is created
- **AND** the answer says that `E-bike motors` is active

#### Scenario: Two starts at once

- **WHEN** two starts are requested at the same time with no active session
- **THEN** exactly one session becomes active
- **AND** the tab opened for the other attempt is closed

#### Scenario: Recording the session fails

- **WHEN** the group is created but the session cannot be recorded
- **THEN** the group's tab is closed
- **AND** the popup, if still open, shows the reason

### Requirement: The session survives a restart

The active session SHALL be kept in the database, not in memory. After the background unloads or the browser restarts, the extension SHALL treat the same session as active as long as a tab group with its recorded id exists.

#### Scenario: Browser restart with session restore

- **GIVEN** the session `E-bike motors` is active
- **WHEN** Firefox is restarted and restores the group
- **THEN** `E-bike motors` is still the active session, with the same group id

#### Scenario: Group gone after a restart

- **GIVEN** the session `E-bike motors` is active
- **WHEN** the browser starts and no group with the session's id exists
- **THEN** the session is no longer active and is kept as saved

### Requirement: The session follows its group

WHEN the session's group is renamed, the session's title SHALL change to match. WHEN the session's group is removed other than by its window closing, the session SHALL end and be kept as saved, not deleted. A removal caused by a window closing SHALL NOT end the session.

#### Scenario: Group renamed

- **WHEN** the user renames the session's group to `Mid-drive motors`
- **THEN** the session's title is `Mid-drive motors`

#### Scenario: Last tab closed

- **WHEN** the user closes the last tab of the session's group
- **THEN** no session is active
- **AND** the ended session is still stored

#### Scenario: Window closes

- **WHEN** the window holding the session's group closes
- **THEN** the session is not ended by that event

### Requirement: The popup shows the active session

WHEN the popup opens and a session is active, it SHALL show that session's title and SHALL NOT offer the title form. WHEN no session is active, it SHALL offer the form. Before deciding, the extension SHALL end a recorded session whose group no longer exists.

#### Scenario: Popup opened during a session

- **GIVEN** the session `E-bike motors` is active
- **WHEN** the user opens the popup
- **THEN** the popup says `E-bike motors` is active
- **AND** it has no title form

#### Scenario: Popup opened after the group was closed

- **GIVEN** the session's group was removed while the extension was not listening
- **WHEN** the user opens the popup
- **THEN** the popup offers the title form
