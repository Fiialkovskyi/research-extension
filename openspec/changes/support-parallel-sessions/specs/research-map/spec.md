# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: The map draws the active session's graph`
- TO: `### Requirement: The map draws the chosen session's graph`

## MODIFIED Requirements

### Requirement: The map draws the chosen session's graph

The map page SHALL draw every node of one chosen session's graph and every edge between them, and SHALL name that session in its title. The session is the one the page was opened for, or the viewed session when it was opened without one. Each node SHALL show its page title, or its URL when the title is empty, and its domain. A SERP node SHALL show its query and be labelled `search`, so its kind is not carried by colour alone. A node whose tab is closed SHALL be visibly distinguished and labelled `closed`, so the state is not carried by colour alone. An edge from a page to the next page in the same tab, an edge from an opener to the tab it opened, and a refinement edge from the root search to a later search SHALL each be drawn differently from the other two. A node SHALL be placed below the node it was reached from. WHEN there is no such session, the page SHALL say so and draw no graph.

#### Scenario: Pages read in one tab and a tab opened from it

- **GIVEN** the chosen session's tab loaded page A and then page B, and a link on B opened page C in a new tab
- **WHEN** the user opens the map
- **THEN** the map shows nodes A, B and C
- **AND** A is labelled `closed`, and B and C are not
- **AND** it shows a same-tab edge from A to B and an opener edge from B to C, drawn differently
- **AND** B is below A, and C is below B

#### Scenario: A search and a refined search

- **GIVEN** the chosen session's tab searched `e-bike motors`, and a second tab searched `e-bike mid-drive motors`
- **WHEN** the user opens the map
- **THEN** both nodes are labelled `search` and show their queries
- **AND** a refinement edge from the first search to the second is drawn unlike same-tab and opener edges
- **AND** the second search is below the first

#### Scenario: Two sessions, two graphs

- **GIVEN** two active sessions with different pages
- **WHEN** the map is opened for one of them
- **THEN** it draws only that session's nodes

#### Scenario: No active session

- **GIVEN** no session exists
- **WHEN** the user opens the map
- **THEN** the map says that no session is chosen and draws no nodes

### Requirement: The popup opens the map

WHEN a session is viewed, the popup SHALL offer to open the map for it. Opening it SHALL select that session's map tab when one is already open, and open one otherwise. The map's tab SHALL NOT be part of any session's group, and SHALL NOT be recorded in any session's graph.

#### Scenario: Map opened from the popup

- **GIVEN** a session is viewed and no map tab is open for it
- **WHEN** the user chooses to open the map in the popup
- **THEN** a map tab opens outside every session's group
- **AND** no session's graph gains a node for it

#### Scenario: Map opened twice

- **GIVEN** a map tab is already open for the viewed session but not selected
- **WHEN** the user chooses to open the map in the popup
- **THEN** that map tab is selected, and no second map tab opens

#### Scenario: No session is active

- **GIVEN** no session exists
- **WHEN** the user opens the popup
- **THEN** the popup does not offer to open the map
