## ADDED Requirements

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
