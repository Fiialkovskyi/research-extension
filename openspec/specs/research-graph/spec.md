# research-graph Specification

## Purpose

Defines how a research session's graph is stored: one node per page with its observed signals, one edge per relation between two nodes, and what is kept when a tab closes.

## Requirements

### Requirement: The graph is stored per session

The extension SHALL store each session's graph in its database: a node for each page recorded in the session, and an edge for each relation between two of its nodes. The graph SHALL survive an unload of the background and a browser restart. Reading a session's graph SHALL return its nodes and edges as they were at one moment.

#### Scenario: Graph read after the background was unloaded

- **GIVEN** a session with three nodes and two edges was recorded
- **WHEN** the background is unloaded and woken again
- **THEN** reading the session's graph returns those three nodes and two edges

#### Scenario: Graphs do not mix

- **GIVEN** two sessions each with recorded nodes
- **WHEN** one session's graph is read
- **THEN** it contains none of the other session's nodes or edges

### Requirement: A relation is stored once

An edge SHALL be identified by its source node, target node and kind. Recording the same relation again SHALL NOT create a second edge or change the first.

#### Scenario: Opener edge recorded twice

- **WHEN** an opener edge from node A to node B is recorded twice
- **THEN** the session's graph holds one opener edge from A to B

### Requirement: Signals accumulate on the node

Observed engagement signals SHALL be merged into the node they belong to: active dwell, copy events, focus count and revisit count SHALL add up, and maximum scroll and last focus time SHALL keep their largest value. Observations recorded at the same time SHALL all be kept. Derived values, such as the engagement state, SHALL NOT be stored.

#### Scenario: Two dwell observations

- **WHEN** 10 s and then 5 s of active dwell are recorded for a node
- **THEN** the node's active dwell is 15 s

#### Scenario: Scroll goes back up

- **WHEN** a scroll depth of 0.8 and then 0.3 is recorded for a node
- **THEN** the node's maximum scroll is 0.8

### Requirement: A closed tab keeps its history

WHEN a node's tab closes, the node SHALL be marked closed and SHALL keep its signals and relations. A closed node SHALL NOT be returned as the node a tab currently shows, even if a later tab reuses the same tab id.

#### Scenario: Tab id reused after a restart

- **GIVEN** a closed node recorded for tab 7
- **WHEN** the node tab 7 currently shows is requested
- **THEN** the closed node is not returned

### Requirement: Pages read in the session's group become nodes

WHEN a page commits in the top frame of a tab that is in the active session's group, the extension SHALL record a node for it within 1 s. It SHALL NOT record a node for a reload, a fragment change, a page that is not `http` or `https`, a tab in a private window, or a tab outside the group.

#### Scenario: Navigating in a session tab

- **GIVEN** a session is active and its group's tab shows `https://example.org/a`, recorded as node A
- **WHEN** the user follows a link to `https://example.org/b` in that tab
- **THEN** a node B is recorded with A as its parent
- **AND** a `sameTab` edge from A to B is recorded
- **AND** A is marked closed

#### Scenario: Reload

- **WHEN** the user reloads a session tab
- **THEN** no node is recorded

#### Scenario: New-tab page

- **WHEN** a session tab shows `about:newtab`
- **THEN** no node is recorded for it

#### Scenario: Tab outside the group

- **WHEN** a page commits in a tab that is not in the session's group
- **THEN** no node is recorded

### Requirement: A tab opened from a session tab is linked to its opener

WHEN a tab opened from a session tab records its first node, that node SHALL name the opener tab's current node as its opener, and an `opener` edge SHALL be recorded.

#### Scenario: Link opened in a new tab

- **GIVEN** node A is shown in a session tab
- **WHEN** the user opens a link from it in a new tab, which joins the group, and the page commits
- **THEN** the new node has A as its opener
- **AND** an `opener` edge from A to the new node is recorded

### Requirement: Capture follows group membership

A tab that joins the session's group SHALL be recorded from the page it shows. A tab that leaves the group, or is closed other than by its window closing, SHALL have its node marked closed, keeping its history.

#### Scenario: Tab dragged into the group

- **WHEN** the user drags a tab showing `https://example.org/c` into the session's group
- **THEN** a node for `https://example.org/c` is recorded

#### Scenario: Tab dragged out of the group

- **WHEN** the user drags a session tab out of the group
- **THEN** its node is marked closed
- **AND** pages it shows afterwards are not recorded

#### Scenario: Tab closed

- **WHEN** the user closes a session tab
- **THEN** its node is marked closed and keeps its signals and edges

### Requirement: Node titles and focus follow the tab

WHEN a session tab's title changes, the title of its current node SHALL change to match, unless the new title is blank. WHEN a session tab is activated, its current node's focus count SHALL increase by one and its last focus time SHALL be set.

#### Scenario: Title arrives after the commit

- **GIVEN** a node was recorded with the previous page's title
- **WHEN** the tab's title changes to `Mid-drive motors`
- **THEN** the node's title is `Mid-drive motors`

#### Scenario: Switching to a session tab

- **WHEN** the user activates a session tab twice
- **THEN** its node's focus count is 2

### Requirement: Capture is reconciled after a restart

WHEN the browser starts, or the extension is installed or updated, with a session active, nodes whose tab is no longer in the session's group showing the same page SHALL be marked closed, and tabs of the session's group without a current node SHALL be recorded.

#### Scenario: Restart with session restore

- **GIVEN** a session tab showing `https://example.org/a` with an open node
- **WHEN** Firefox restarts and restores the group
- **THEN** the session has exactly one open node for `https://example.org/a`

### Requirement: Capture follows a restored session

A closed session SHALL record nothing. WHEN the session's group comes back under its id, nodes whose tab is no longer in the group showing the same page SHALL be marked closed. WHEN a tab that carries the session's id comes back into the session — inside its group, added to it, or followed in a new group — it SHALL be recorded from the page it shows, without waiting for a navigation. A tab newly opened in the session's group SHALL be recorded by its first navigation, not on creation.

#### Scenario: Group deleted and restored

- **GIVEN** a session tab showing `https://example.org/a` with an open node
- **WHEN** the user deletes the session's group and restores it with Ctrl+Shift+T
- **THEN** the session has exactly one open node for `https://example.org/a`

#### Scenario: Tab restored after its group is gone

- **GIVEN** the session's group was removed by closing its tabs one by one
- **WHEN** the user restores the tab that showed `https://example.org/a`
- **THEN** the session is active and has an open node for `https://example.org/a`
