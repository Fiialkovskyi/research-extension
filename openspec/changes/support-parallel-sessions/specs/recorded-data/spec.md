# Spec Delta

## MODIFIED Requirements

### Requirement: The user can see what a session recorded

WHILE a session is viewed, the popup SHALL offer a "What was recorded" page for it, whether the session is active, closed or saved. The page SHALL name the session it shows, and SHALL list every page of that session with its title, URL, when it was recorded, its signals — active reading time, scroll depth, copies, focus count, revisits and quick returns — whether a snapshot of its text exists with its size, and how many vectors it has. The snapshot's text SHALL be shown only when the user asks for it, decrypted. The page SHALL make no network request.

#### Scenario: A deep-read page

- **GIVEN** the session recorded page A, read for 2 minutes, scrolled to 80%, copied from once, with a 12 KB snapshot and 4 vectors
- **WHEN** the user opens "What was recorded"
- **THEN** A's entry shows those values
- **AND** choosing to show its text displays the article text

#### Scenario: Two sessions

- **GIVEN** two sessions with different pages, one of them viewed
- **WHEN** the user opens "What was recorded"
- **THEN** only the viewed session's pages are listed, under its title

#### Scenario: No session

- **GIVEN** no session exists
- **THEN** the popup does not offer "What was recorded", and the page, opened directly, says there is nothing to show
