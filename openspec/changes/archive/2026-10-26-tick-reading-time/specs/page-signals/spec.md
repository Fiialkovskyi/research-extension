# Spec Delta

## MODIFIED Requirements

### Requirement: Active reading time is measured

The extension SHALL add to a session node's active dwell the time during which its tab is the selected tab of the focused browser window and the user is not idle, idle meaning 60 s without input. Time while another window or application has focus, while the user is idle, or after the tab moved on SHALL NOT count. A single uninterrupted stretch SHALL count at most 10 minutes. Time SHALL NOT be lost when the background is unloaded. While an observed page is visible, the extension SHALL bring its reading time up to date at least every 10 s, without waiting for the user to scroll, copy, change tab or go idle, and SHALL judge the page deep read as soon as the time brought up to date reaches the rule's threshold.

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

#### Scenario: Reading in stillness

- **GIVEN** a page in a session tab was scrolled to 50% within 5 s and is then read, with no further scroll, for 60 s
- **WHEN** 60 s have passed
- **THEN** the page's node has about 50 s of active dwell, and its text has been asked for

#### Scenario: A page that is hidden

- **GIVEN** an observed page whose tab is not the selected tab
- **WHEN** time passes
- **THEN** the page sends nothing and its node gains no dwell

#### Scenario: A window behind another application

- **GIVEN** an observed page that is visible but whose window is not focused
- **WHEN** time passes
- **THEN** its node gains no dwell

#### Scenario: A page the tab has left

- **GIVEN** a tick arrives from a page whose tab now shows another node
- **WHEN** the background handles it
- **THEN** nothing is added to either node

### Requirement: Engagement is derived from signals

A node's engagement state SHALL be derived from its signals by a named, versioned rule set, `engagement_rules@3`, and SHALL NOT be stored. `unread`: never focused. `deep_read`: active dwell of at least 30 s and scroll depth of at least 40%, or any copy event, or at least 2 revisits of 20 s or more. `dead_end`: not deep read, and either a quick return, or active dwell under 8 s with scroll depth under 15% once the node is no longer focused. `skimmed`: otherwise.

#### Scenario: A copy makes a page deep read

- **GIVEN** a focused session page
- **WHEN** the user copies text from it once
- **THEN** its node's engagement is `deep_read`

#### Scenario: A page never focused

- **GIVEN** a session page opened in a background tab and never selected
- **THEN** its node's engagement is `unread`

#### Scenario: Read closely

- **WHEN** the user reads a session page for 35 s and scrolls through half of it
- **THEN** its node's engagement is `deep_read`

#### Scenario: Not yet read closely

- **WHEN** the user reads a session page for 25 s and scrolls through half of it
- **THEN** its node's engagement is `skimmed`

#### Scenario: Abandoned at a glance

- **WHEN** the user selects a session page, leaves it after 4 s without scrolling, and selects another tab
- **THEN** its node's engagement is `dead_end`

#### Scenario: Abandoned for the search

- **GIVEN** a result page the user scrolled through a third of in 9 s
- **WHEN** the user goes straight back to the search results
- **THEN** its node's engagement is `dead_end`

#### Scenario: Still being looked at

- **GIVEN** the user selected a session page 4 s ago and has not scrolled
- **THEN** its node's engagement is `skimmed`, not `dead_end`
