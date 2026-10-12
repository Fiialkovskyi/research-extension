## MODIFIED Requirements

### Requirement: The popup shows the active session

WHEN the popup opens and a session is active, it SHALL show that session's title and the number of pages the session has recorded, and SHALL NOT offer the title form. WHEN no session is active, it SHALL offer the form. Before deciding, the extension SHALL end a recorded session whose group no longer exists.

#### Scenario: Popup opened during a session

- **GIVEN** the session `E-bike motors` is active and has recorded 2 pages
- **WHEN** the user opens the popup
- **THEN** the popup says `E-bike motors` is active with 2 pages recorded
- **AND** it has no title form

#### Scenario: Popup opened after the group was closed

- **GIVEN** the session's group was removed while the extension was not listening
- **WHEN** the user opens the popup
- **THEN** the popup offers the title form
