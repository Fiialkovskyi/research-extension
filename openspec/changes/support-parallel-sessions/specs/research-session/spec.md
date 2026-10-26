# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: At most one session is active`
- TO: `### Requirement: Several sessions may be active`
- FROM: `### Requirement: The popup shows the active session`
- TO: `### Requirement: The popup shows the viewed session`

## MODIFIED Requirements

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
