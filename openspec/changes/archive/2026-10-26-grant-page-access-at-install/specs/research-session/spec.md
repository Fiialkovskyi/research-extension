# Spec Delta

## MODIFIED Requirements

### Requirement: Starting a session asks for page access

WHEN the user submits a session title and the extension does not have access to page contents, which holds only if the user revoked it after install, it SHALL ask the browser for it as part of the same click. The session SHALL start whether access is granted, refused or left unanswered. WHEN the extension has page access, the browser SHALL NOT be asked.

#### Scenario: First session

- **GIVEN** the extension was installed and page access was granted with the install
- **WHEN** the user submits `E-bike motors`
- **THEN** the browser is not asked for access
- **AND** the session `E-bike motors` starts

#### Scenario: Access was revoked

- **GIVEN** the user switched page access off in the add-on's permissions
- **WHEN** the user submits `E-bike motors`
- **THEN** the browser asks the user to allow access to page contents
- **AND** the session `E-bike motors` starts

#### Scenario: Access refused

- **WHEN** the user refuses page access while starting a session
- **THEN** the session is active all the same

### Requirement: The popup says when page access is missing

WHEN a session is active and page access has been revoked, the popup SHALL say that reading and scrolling are not being recorded, and SHALL offer a control that asks for page access again. WHEN access is granted, the popup SHALL NOT show either.

#### Scenario: Popup without page access

- **GIVEN** a session is active and page access was revoked
- **WHEN** the user opens the popup
- **THEN** it says reading and scrolling are not being recorded
- **AND** it offers to allow page access

#### Scenario: Popup with page access

- **GIVEN** a session is active and page access is granted, as it is after install
- **WHEN** the user opens the popup
- **THEN** it shows no page-access notice
