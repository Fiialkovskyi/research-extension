# Spec Delta

## MODIFIED Requirements

### Requirement: The user resumes a saved session

Resuming SHALL be allowed while other sessions are active or closed, and SHALL leave them as they are. It SHALL recreate a tab group with the session's title holding the saved tabs in their saved order; every tab but the left-off page SHALL open without loading, and the left-off page SHALL open loaded and selected. The session's saved pages SHALL be reopened on the new tabs rather than recorded again, and the session SHALL become active, following the new group. The popup SHALL offer Resume beside Delete for a chosen saved session, with no warning, and SHALL make the resumed session the viewed one.

#### Scenario: Resuming

- **GIVEN** the saved session `E-bike motors` with tabs A, B and C, left off at B
- **WHEN** the user chooses "Resume"
- **THEN** a group `E-bike motors` holds tabs A, B and C in that order, B loaded and selected, A and C not loaded
- **AND** the session is active with the same three pages and no new ones

#### Scenario: Another session is active

- **GIVEN** the active session `Batteries`
- **WHEN** the user resumes `E-bike motors`
- **THEN** both sessions are active
- **AND** the tabs and group of `Batteries` are untouched
- **AND** `E-bike motors` is the viewed session
