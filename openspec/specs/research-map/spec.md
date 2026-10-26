# research-map Specification

## Purpose

Defines the research map: a page that draws the active session's graph so the user can see what was captured, keeps it current while the user browses, and lets the user return to a page's tab from it.

## Requirements

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

### Requirement: The map stays current

WHILE the map page is open, it SHALL reflect changes to the active session and its graph without being reloaded: a page recorded, a node closed, a title changed, the session renamed, started or ended. A change SHALL appear within one second of being recorded.

#### Scenario: A page is read while the map is open

- **GIVEN** the map is open and shows the session's node A
- **WHEN** the session's tab loads page B
- **THEN** within one second the map shows node B, a same-tab edge from A to B, and A labelled `closed`, without a reload

#### Scenario: The session ends while the map is open

- **GIVEN** the map is open and shows the session's graph
- **WHEN** the user closes the session's group
- **THEN** within one second the map says that no session is active

### Requirement: Activating a node returns to its tab

Activating a node whose tab is open, by pointer or by keyboard, SHALL select that tab and focus its window. Activating a closed node SHALL change no tab. Only tabs that hold an open node of the active session SHALL be selectable this way.

#### Scenario: Open node clicked

- **GIVEN** the map shows node B whose tab is open but not selected
- **WHEN** the user clicks node B
- **THEN** B's tab becomes the selected tab of its window, and that window is focused

#### Scenario: Open node activated from the keyboard

- **GIVEN** the map shows node B whose tab is open
- **WHEN** the user moves keyboard focus to node B and presses Enter
- **THEN** B's tab becomes the selected tab

#### Scenario: Closed node clicked

- **GIVEN** the map shows node A labelled `closed`
- **WHEN** the user clicks node A
- **THEN** the selected tab does not change

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

### Requirement: The map works offline

The map page SHALL render from code and styles inside the package and SHALL issue no outbound network request while it renders or updates.

#### Scenario: Map renders without the network

- **WHEN** the map page is opened and finishes rendering a session's graph
- **THEN** the extension has issued no outbound network request

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

### Requirement: Co-attention is drawn as a lateral link

The map SHALL draw a `coAttention` edge without an arrowhead and with a dash pattern unlike the opener, same-tab and refinement edges, so its kind is not carried by colour alone. A `coAttention` edge SHALL NOT affect which page is placed below which.

#### Scenario: Two pages compared

- **GIVEN** pages A and B, opened from the same search, joined by a `coAttention` edge
- **WHEN** the user opens the map
- **THEN** the edge between A and B has no arrowhead and is drawn unlike the other kinds
- **AND** A and B are placed as they would be without it, both below the search
