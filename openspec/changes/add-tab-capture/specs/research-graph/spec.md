## ADDED Requirements

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

WHEN the browser starts with a session active, nodes whose tab did not come back SHALL be marked closed, and tabs of the session's group without a current node SHALL be recorded.

#### Scenario: Restart with session restore

- **GIVEN** a session tab showing `https://example.org/a` with an open node
- **WHEN** Firefox restarts and restores the group
- **THEN** the session has exactly one open node for `https://example.org/a`
