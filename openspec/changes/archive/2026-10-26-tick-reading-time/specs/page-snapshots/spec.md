# Spec Delta

## MODIFIED Requirements

### Requirement: A deep-read page's text is captured once

WHEN a session node first becomes `deep_read` while its page is still open and observed, the extension SHALL extract the page's readable text, the main content without navigation, scripts or styles, and store it as that node's snapshot. A node SHALL have at most one snapshot; it SHALL NOT be captured again when it stays or becomes `deep_read` again.

#### Scenario: Copying from an article

- **GIVEN** a session page showing an article, observed and not yet deep read
- **WHEN** the user copies text from it
- **THEN** a snapshot holding the article's text is stored for its node
- **AND** the node carries the snapshot's content hash

#### Scenario: A second copy

- **GIVEN** a node that already has a snapshot
- **WHEN** the user copies from its page again
- **THEN** the node still has exactly one snapshot

#### Scenario: Read long enough

- **GIVEN** a session page, observed, scrolled through half of it
- **WHEN** the user's active dwell on it reaches 30 s and the user then selects another tab
- **THEN** a snapshot of its text is stored for its node

#### Scenario: A page that is not deep read

- **WHEN** the user glances at a session page for 10 s without copying from it
- **THEN** no snapshot is stored for its node
