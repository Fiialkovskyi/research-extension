# Spec Delta

## ADDED Requirements

### Requirement: The map shows each page's engagement

Each drawn node SHALL show its engagement state — `unread`, `skimmed`, `deep read` or `dead end` — in words and by a marker whose shape differs between states, so the state is not carried by colour alone. WHEN a node's engagement changes, the map SHALL show the new state within one second, without being reloaded.

#### Scenario: A page becomes deep read

- **GIVEN** the map is open and shows a session page as `skimmed`
- **WHEN** the user copies text from that page
- **THEN** within one second the map shows the page as `deep read`

#### Scenario: A page opened in the background

- **GIVEN** a session page was opened in a background tab and never selected
- **WHEN** the user opens the map
- **THEN** the page is shown as `unread`
