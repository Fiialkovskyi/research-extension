# Spec Delta

## MODIFIED Requirements

### Requirement: The map draws the active session's graph

The map page SHALL draw every node of the active session's graph and every edge between them. Each node SHALL show its page title, or its URL when the title is empty, and its domain. A SERP node SHALL show its query and be labelled `search`, so its kind is not carried by colour alone. A node whose tab is closed SHALL be visibly distinguished and labelled `closed`, so the state is not carried by colour alone. An edge from a page to the next page in the same tab, an edge from an opener to the tab it opened, and a refinement edge from the root search to a later search SHALL each be drawn differently from the other two. A node SHALL be placed below the node it was reached from. WHEN no session is active, the page SHALL say that no session is active and draw no graph.

#### Scenario: Pages read in one tab and a tab opened from it

- **GIVEN** the active session's tab loaded page A and then page B, and a link on B opened page C in a new tab
- **WHEN** the user opens the map
- **THEN** the map shows nodes A, B and C
- **AND** A is labelled `closed`, and B and C are not
- **AND** it shows a same-tab edge from A to B and an opener edge from B to C, drawn differently
- **AND** B is below A, and C is below B

#### Scenario: A search and a refined search

- **GIVEN** the active session's tab searched `e-bike motors`, and a second tab searched `e-bike mid-drive motors`
- **WHEN** the user opens the map
- **THEN** both nodes are labelled `search` and show their queries
- **AND** a refinement edge from the first search to the second is drawn unlike same-tab and opener edges
- **AND** the second search is below the first

#### Scenario: No active session

- **GIVEN** no session is active
- **WHEN** the user opens the map
- **THEN** the map says that no session is active and draws no nodes
