# page-signals Specification

## Purpose

Defines the engagement signals of a session page — active reading time, revisits, scroll depth and
copy events — how they reach the page's node, and how a node's engagement state is derived from them.

## Requirements

### Requirement: Active reading time is measured

The extension SHALL add to a session node's active dwell the time during which its tab is the selected tab of the focused browser window and the user is not idle, idle meaning 60 s without input. Time while another window or application has focus, while the user is idle, or after the tab moved on SHALL NOT count. A single uninterrupted stretch SHALL count at most 10 minutes. Time SHALL NOT be lost when the background is unloaded.

#### Scenario: Reading, then switching tabs

- **WHEN** the user reads a session page for 30 s and then selects another tab
- **THEN** the page's node records about 30 s of active dwell

#### Scenario: Firefox loses focus

- **GIVEN** the user is reading a session page
- **WHEN** another application is focused for 2 minutes and then Firefox is focused again
- **THEN** those 2 minutes are not added to the node's active dwell

#### Scenario: The user goes idle

- **GIVEN** the user is reading a session page
- **WHEN** the browser reports the user idle
- **THEN** dwell stops counting from the moment the user's input stopped, not from when idleness was reported

#### Scenario: The background is unloaded mid-read

- **GIVEN** the user is reading a session page
- **WHEN** the background is unloaded and woken again by the next tab switch
- **THEN** the time read before the switch is recorded on the page's node

#### Scenario: Not a session tab

- **WHEN** the user reads a page in a tab outside the session's group
- **THEN** no active dwell is recorded for any node

### Requirement: Revisits are counted

A visit to a node SHALL be the time from its tab being selected until another node gets focus. A visit to a node that already had active dwell before it began SHALL count as one revisit once it reaches 20 s of active dwell. A visit SHALL be counted at most once, and losing and regaining window focus or idleness SHALL NOT start a new visit.

#### Scenario: Coming back to a page

- **GIVEN** the user read page A, then switched to page B
- **WHEN** the user switches back to A and reads it for 25 s
- **THEN** A's revisit count is 1

#### Scenario: A short return

- **GIVEN** the user read page A, then switched to page B
- **WHEN** the user switches back to A for 5 s
- **THEN** A's revisit count is unchanged

#### Scenario: Window focus lost and regained

- **GIVEN** the user is reading page A for the first time
- **WHEN** another application is focused and then Firefox again
- **THEN** A's revisit count is unchanged

### Requirement: Pages are observed only in session tabs

The extension SHALL observe a page's contents only in a tab of the active session's group, and only in its top frame. It SHALL NOT observe pages in any other tab, in a private window, or while no session is active. A tab that joins the group SHALL be observed from its current page on; a tab that leaves it SHALL stop being observed.

#### Scenario: A page loaded in the session's group

- **GIVEN** a session is active and page access was granted
- **WHEN** a page loads in a tab of the session's group
- **THEN** that page is observed

#### Scenario: A page outside the group

- **GIVEN** a session is active
- **WHEN** a page loads in a tab outside the session's group
- **THEN** nothing is observed in that page and nothing is recorded for it

#### Scenario: A tab leaves the group

- **GIVEN** a session tab whose page is observed
- **WHEN** the tab is moved out of the session's group and the user scrolls its page
- **THEN** no signal is added to any node

### Requirement: Scroll depth and copy events are recorded

For an observed page, the extension SHALL record the deepest scroll position reached, as the fraction of the page's height that has been in view, from 0 to 1, and the number of copy events. It SHALL NOT read the clipboard, the selected text, or anything the user types.

#### Scenario: Scrolling down and back up

- **WHEN** the user scrolls a session page to 80% of its height and then back to the top
- **THEN** the page's node records a maximum scroll of 0.8

#### Scenario: Copying twice

- **WHEN** the user copies text from a session page twice
- **THEN** the page's node records 2 copy events
- **AND** the copied text appears nowhere in what the extension stored

### Requirement: Observations are batched

An observed page SHALL send what it observed in batches, at most one every 2 seconds, and SHALL also send what it has when the page is hidden and when it is left. A batch with nothing new SHALL NOT be sent. Handling an observed event SHALL take under 1 ms on the page's main thread at the 95th percentile, and scroll position SHALL be measured at most once per rendered frame.

#### Scenario: Continuous scrolling

- **WHEN** the user scrolls a session page continuously for 10 seconds
- **THEN** the page sends at most 6 batches in that time

#### Scenario: Leaving the page

- **GIVEN** the user scrolled a session page less than 2 seconds ago
- **WHEN** the tab navigates to another page
- **THEN** that scroll is recorded on the node of the page that was left

#### Scenario: Nothing new

- **WHEN** a session page stays open without being scrolled or copied from
- **THEN** it sends no batch

### Requirement: A batch is recorded on the page that produced it

A batch SHALL be added to the node of the page that produced it, through the same accumulation as every other signal. A batch from a tab that is not a session tab, or from a page that is no longer its tab's current node, SHALL be dropped; a page whose batch was dropped because its tab is no longer a session tab SHALL stop observing.

#### Scenario: A batch arriving after the tab moved on

- **GIVEN** a session tab showed page A and has navigated to page B
- **WHEN** a batch produced on page A arrives
- **THEN** it is added to A's node, or dropped, and never added to B's node

#### Scenario: A batch from a tab that left the session

- **GIVEN** an observed tab was moved out of the session's group
- **WHEN** its page sends a batch
- **THEN** the batch is dropped and the page stops observing

### Requirement: Engagement is derived from signals

A node's engagement state SHALL be derived from its signals by a named, versioned rule set, `engagement_rules@1`, and SHALL NOT be stored. `unread`: never focused. `deep_read`: active dwell of at least 45 s and scroll depth of at least 40%, or any copy event, or at least 2 revisits. `dead_end`: not deep read, and active dwell under 8 s with scroll depth under 15%, once the node is no longer focused. `skimmed`: otherwise.

#### Scenario: A copy makes a page deep read

- **GIVEN** a focused session page
- **WHEN** the user copies text from it once
- **THEN** its node's engagement is `deep_read`

#### Scenario: A page never focused

- **GIVEN** a session page opened in a background tab and never selected
- **THEN** its node's engagement is `unread`

#### Scenario: Read closely

- **WHEN** the user reads a session page for 50 s and scrolls through half of it
- **THEN** its node's engagement is `deep_read`

#### Scenario: Abandoned at a glance

- **WHEN** the user selects a session page, leaves it after 4 s without scrolling, and selects another tab
- **THEN** its node's engagement is `dead_end`

#### Scenario: Still being looked at

- **GIVEN** the user selected a session page 4 s ago and has not scrolled
- **THEN** its node's engagement is `skimmed`, not `dead_end`

### Requirement: Capture continues without page access

WHEN page access has not been granted, the extension SHALL keep recording the session's pages, relations, titles, focus, active dwell and revisits, and SHALL observe nothing inside pages. WHEN page access is granted while a session is active, the extension SHALL begin observing the session's open pages without a reload.

#### Scenario: Access refused

- **GIVEN** the user refused page access when starting the session
- **WHEN** the user reads a page in the session's group
- **THEN** a node is recorded for it with its active dwell, and with no scroll and no copy events

#### Scenario: Access granted later

- **GIVEN** a session tab is open and page access was refused
- **WHEN** the user grants page access from the popup and then scrolls that tab's page
- **THEN** the scroll is recorded on its node
