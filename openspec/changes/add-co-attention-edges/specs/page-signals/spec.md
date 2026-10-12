# Spec Delta

## ADDED Requirements

### Requirement: A quick return to the search is counted

WHEN the first visit to a page reached from a search result page ends with focus moving to a search result page of the session, before the page has 10 s of active dwell, the page's node SHALL count one quick return. A page is reached from a search result page when its previous node in the same tab, or the node that opened its tab, is one. Going back in the same tab and switching to the search's tab SHALL both count. A revisit SHALL NOT count.

#### Scenario: Back to the results at once

- **GIVEN** the user opened result page P from a search in the same tab
- **WHEN** after 4 s the user goes back to the search results
- **THEN** P's node counts one quick return

#### Scenario: A result read for a while

- **GIVEN** the user opened result page P from a search
- **WHEN** after 30 s the user goes back to the search results
- **THEN** P's node counts no quick return

#### Scenario: A page not reached from a search

- **GIVEN** page Q was reached by following a link on an ordinary page
- **WHEN** after 4 s the user switches to a search results tab
- **THEN** Q's node counts no quick return

## MODIFIED Requirements

### Requirement: Engagement is derived from signals

A node's engagement state SHALL be derived from its signals by a named, versioned rule set, `engagement_rules@2`, and SHALL NOT be stored. `unread`: never focused. `deep_read`: active dwell of at least 45 s and scroll depth of at least 40%, or any copy event, or at least 2 revisits of 20 s or more. `dead_end`: not deep read, and either a quick return, or active dwell under 8 s with scroll depth under 15% once the node is no longer focused. `skimmed`: otherwise.

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

#### Scenario: Abandoned for the search

- **GIVEN** a result page the user scrolled through a third of in 9 s
- **WHEN** the user goes straight back to the search results
- **THEN** its node's engagement is `dead_end`

#### Scenario: Still being looked at

- **GIVEN** the user selected a session page 4 s ago and has not scrolled
- **THEN** its node's engagement is `skimmed`, not `dead_end`
