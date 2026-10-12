# research-tree Specification

## Purpose

Defines the research tree shown in the toolbar popup: the active session drawn as a tree of the pages
the user reached and how they reached them, with each page's engagement, an unread queue, full
keyboard use, and live updates.

## Requirements

### Requirement: The popup draws the session as a tree

WHILE a session is active, the popup SHALL show every page of its graph as a tree. A page SHALL be placed under the page it was reached from — the previous page in its tab, or, for a tab's first page, the page that opened its tab — and a page reached from neither SHALL be at the top level. Siblings SHALL be in the order they were recorded. WHEN no session is active, the popup SHALL show no tree.

#### Scenario: A search and what came of it

- **GIVEN** a session tab searched `e-bike motors`, opened result A in a new tab, and then followed a link from A to B in that tab
- **WHEN** the user opens the popup
- **THEN** the search is at the top level, A is under it, and B is under A

#### Scenario: No active session

- **WHEN** the user opens the popup without an active session
- **THEN** it shows no tree

### Requirement: A row says what the user did with the page

Each row SHALL show the page's title, or a search's query labelled `search`, and its engagement state in words and by a marker whose shape differs between states. It SHALL show a copy marker whose accessible name says it was copied from when the user copied from the page, and SHALL say `closed` when the page's tab is closed. Colour SHALL NOT be the only carrier of any of these.

#### Scenario: A page copied from

- **GIVEN** the user copied text from page A
- **WHEN** the popup shows A
- **THEN** A's row shows `deep read` and a copy marker named `copied from`

#### Scenario: A closed page

- **GIVEN** page A's tab moved on to page B
- **THEN** A's row says `closed`

### Requirement: The unread queue lists pages never looked at

Above the tree, the popup SHALL list the session's open pages that are `unread`, with their number, oldest first, and SHALL say so when there are none. Activating an entry SHALL select its tab.

#### Scenario: Pages opened in the background

- **GIVEN** the user opened pages C and D in background tabs from a session page, C first
- **WHEN** the user opens the popup
- **THEN** the unread queue says 2 and lists C before D

#### Scenario: Reading one

- **GIVEN** C is in the unread queue
- **WHEN** the user activates C's entry
- **THEN** C's tab is selected, and the next time the popup opens C is not in the queue

### Requirement: The tree is used from the keyboard

The tree SHALL follow the WAI-ARIA tree pattern: it is a single tab stop; Down and Up move to the next and previous visible row; Right expands a collapsed row or moves to its first child; Left collapses an expanded row or moves to its parent; Home and End move to the first and last visible row; Enter on an open page selects its tab. Every row SHALL expose its level, its position among its siblings, and, when it has children, whether it is expanded.

#### Scenario: Walking the tree

- **GIVEN** the tree shows a search with result A, and A has child B, all expanded
- **WHEN** the user focuses the tree and presses Down twice
- **THEN** B is the focused row
- **AND** pressing Left moves focus to A, and pressing Left again collapses A

#### Scenario: Returning to a page from the keyboard

- **WHEN** the user focuses the row of open page A and presses Enter
- **THEN** A's tab is selected

### Requirement: The tree stays current while the popup is open

WHILE the popup is open, the tree SHALL reflect changes to the active session's graph without the popup being reopened, within one second of their being recorded, and SHALL keep the rows the user collapsed collapsed. Activating a closed page SHALL change no tab.

#### Scenario: A collapsed branch stays collapsed

- **GIVEN** the popup is open and the user collapsed result A's row
- **WHEN** a page is recorded under A
- **THEN** A's row is still collapsed, and A shows it has children

#### Scenario: A closed page is activated

- **WHEN** the user presses Enter on a closed page's row
- **THEN** no tab is selected

### Requirement: The tree groups pages by cluster

WHEN the active session has been clustered into more than one cluster, the popup's tree SHALL show each cluster that holds two or more pages as a top-level row named by the cluster's label and its number of pages, with that cluster's pages arranged under it as the tree arranges them. Cluster rows SHALL be in the order their first pages were recorded. Pages in clusters of one SHALL be gathered under a single top-level row named `Unclustered`, after the cluster rows. A cluster row SHALL be expandable and collapsible like any other row and SHALL NOT select a tab. WHEN the session has not been clustered or has one cluster, the tree SHALL be shown ungrouped.

#### Scenario: Two threads

- **GIVEN** the session is clustered into `e-bike motors` with 3 pages and `battery range` with 2 pages, and one lone page
- **WHEN** the user opens the popup
- **THEN** the tree's top level is `e-bike motors · 3`, `battery range · 2` and `Unclustered · 1`, in that order
- **AND** each holds its pages nested as before

#### Scenario: Before clustering

- **GIVEN** a session that has not been clustered yet
- **WHEN** the user opens the popup
- **THEN** the tree is shown ungrouped
