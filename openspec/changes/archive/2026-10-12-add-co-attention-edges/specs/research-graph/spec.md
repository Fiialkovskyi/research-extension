# Spec Delta

## ADDED Requirements

### Requirement: Pages read side by side are linked by co-attention

WHEN focus moves between the same two nodes of the active session at least 3 times within 5 minutes, counting moves in either direction, the extension SHALL record one `coAttention` edge between them. The edge SHALL be recorded once per pair, however often the pages are compared afterwards. A move SHALL count only when focus goes from one node to another; a window losing and regaining focus, or the user going idle, SHALL NOT count. The moves SHALL survive the background being unloaded.

#### Scenario: Comparing two product pages

- **GIVEN** session pages A and B in two tabs
- **WHEN** the user switches A → B → A → B within 2 minutes
- **THEN** a `coAttention` edge between A and B is recorded

#### Scenario: Too slow to be a comparison

- **WHEN** the user switches A → B, and then B → A and A → B over the next 10 minutes
- **THEN** no `coAttention` edge is recorded

#### Scenario: Compared again later

- **GIVEN** a `coAttention` edge between A and B
- **WHEN** the user switches between them three more times
- **THEN** the graph still holds one `coAttention` edge between A and B

#### Scenario: Through a page of another tab in between

- **WHEN** the user switches A → C → B → A → B → A within 2 minutes
- **THEN** a `coAttention` edge between A and B is recorded, and none involving C
