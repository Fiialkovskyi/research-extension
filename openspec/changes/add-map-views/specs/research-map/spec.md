# Spec Delta

## ADDED Requirements

### Requirement: The map has four views

The map page SHALL draw the active session in four views: a simple history, the tree, anchors and telemetry. A switcher in the header SHALL pick the view, as SHALL the keys 1 to 4 when no field has focus and no modifier is held. The page's address SHALL name the current view, so a reload opens the same one. With no view named, the map SHALL open the tree.

#### Scenario: Switching by key

- **WHEN** the user presses 4 on the map page
- **THEN** the telemetry view is shown and the address ends in `#telemetry`

#### Scenario: Reloading keeps the view

- **GIVEN** the map shows the anchor view
- **WHEN** the page is reloaded
- **THEN** the anchor view is shown

### Requirement: The simple history lists reading in order

The history view SHALL list every stretch of reading in time order, with its start time and length, a page appearing again where the user came back to it. Activating an open page's row SHALL select its tab. A session with no logged reading SHALL be listed in the order its pages were opened, and the view SHALL say that durations are missing.

#### Scenario: Coming back to a page

- **WHEN** the user reads A, then B, then A again
- **THEN** the history lists A, B, A

### Requirement: The anchor view shows where research concentrated

The anchor view SHALL draw the pages that meet `anchor_rules@1` (at least 2 revisits, at least 2 copies and pastes together, or at least 3 minutes of reading) and the page the session began from. Each anchor SHALL show its visits, reading time, copies and pastes, and SHALL be sized by reading time. Anchors SHALL be joined by the moves the user made between them, with arrows for the directions taken. A page pasted into more than copied from SHALL be marked, in words, as where research is being collected. A "Show paths" switch SHALL add every other page in the tree of how it was reached.

#### Scenario: Moving back and forth

- **GIVEN** pages A and B are anchors
- **WHEN** the user reads A, a forum page, B, then A
- **THEN** A and B are joined by an edge with arrows both ways

#### Scenario: No anchors yet

- **WHEN** no page meets the anchor rules
- **THEN** the view says that pages become anchors after returns, copies or long reads

### Requirement: The telemetry view draws reading as a timeline

The telemetry view SHALL draw every logged interval of reading as a block on a time axis, coloured by its page's cluster and taller the longer it lasted, label each run of one cluster above the strip, name every colour in a legend, and mark copies and pastes by distinct shapes. A pause longer than 15 minutes SHALL be drawn as a break. Hovering or focusing a block SHALL show the page, its cluster, its start and length, and up to 600 characters of the page's captured text, read locally. Activating the block of an open page SHALL select its tab.

#### Scenario: Hovering a block

- **WHEN** the user hovers the block of a deep-read page
- **THEN** a tooltip shows the page's cluster, time, length, title and the start of its text

#### Scenario: A session from before reading was logged

- **WHEN** the telemetry view is opened for a session with no logged reading
- **THEN** it says reading time is logged from now on
