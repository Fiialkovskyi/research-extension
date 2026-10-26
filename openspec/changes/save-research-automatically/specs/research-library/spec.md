# research-library Delta

## REMOVED Requirements

### Requirement: The user saves a session

**Reason**: Saving no longer waits for the user; a session the user forgot to save was lost to the library.

**Migration**: Replaced by "A session is saved as the user goes". Closing the session's group is how research is put aside; it can be resumed from the library.

## ADDED Requirements

### Requirement: A session is saved as the user goes

The extension SHALL keep the active session saved without being asked; the popup SHALL NOT offer a control to save it. WHILE a session is active, the extension SHALL record its group's tabs in order, each with its URL and page, once capture has been quiet for 1 second and no later than 5 seconds after the first unrecorded change. A record SHALL NOT be taken of an empty group. WHEN the session closes, the extension SHALL record the page the user was on — the page in focus, or else the one focused last — with how far it was read, and when.

#### Scenario: Browsing

- **GIVEN** the active session `E-bike motors` with tabs A and C
- **WHEN** a second has passed since the user last navigated or switched tabs
- **THEN** the session records tabs A and C in that order

#### Scenario: Closing the group

- **GIVEN** the active session `E-bike motors` with three tabs recorded, the user reading page B
- **WHEN** the user closes the session's group
- **THEN** the session keeps its three tabs in order and B as where the user left off
- **AND** no session is active

#### Scenario: No control to save

- **GIVEN** an active session
- **WHEN** the user opens the popup
- **THEN** it offers no control to save the session

## MODIFIED Requirements

### Requirement: The library lists saved sessions

WHEN no session is active, the popup SHALL list the saved and closed sessions, newest first, each with its title, when it was saved, how many pages it recorded and the page the user left off at, with "Resume" and a delete control that asks for confirmation.

#### Scenario: Two saved sessions

- **GIVEN** sessions `Batteries` saved yesterday and `E-bike motors` saved today
- **WHEN** the user opens the popup with no active session
- **THEN** it lists `E-bike motors` before `Batteries`, each with its page count and where it was left off

#### Scenario: A session whose group was closed

- **GIVEN** the user closed the group of the session `E-bike motors`
- **WHEN** the user opens the popup
- **THEN** the library lists `E-bike motors`, with where it was left off

### Requirement: The user resumes a saved session

Resuming SHALL be refused while another session is active. It SHALL accept a saved or a closed session, and SHALL end any other closed session as starting one does. It SHALL recreate a tab group with the session's title holding the saved tabs in their saved order; every tab but the left-off page SHALL open without loading, and the left-off page SHALL open loaded and selected. The session's saved pages SHALL be reopened on the new tabs rather than recorded again, any other page of the session still recorded as open SHALL be closed, and the session SHALL become active, following the new group.

#### Scenario: Resuming

- **GIVEN** the saved session `E-bike motors` with tabs A, B and C, left off at B
- **WHEN** the user chooses "Resume"
- **THEN** a group `E-bike motors` holds tabs A, B and C in that order, B loaded and selected, A and C not loaded
- **AND** the session is active with the same three pages and no new ones

#### Scenario: Resuming a closed session

- **GIVEN** the session `E-bike motors` is closed, its window having been closed
- **WHEN** the user chooses "Resume" on it
- **THEN** it is active on a new group holding its saved tabs
- **AND** only the pages on those tabs are open

#### Scenario: Another session is active

- **GIVEN** the active session `Batteries`
- **WHEN** the user tries to resume `E-bike motors`
- **THEN** resuming is refused and no tab is opened
