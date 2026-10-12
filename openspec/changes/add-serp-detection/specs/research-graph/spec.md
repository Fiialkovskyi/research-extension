# Spec Delta

## ADDED Requirements

### Requirement: Search result pages become SERP nodes

WHEN a page recorded in the session is a results page of Google, Bing, DuckDuckGo, Startpage, Ecosia, Kagi or Brave Search, and its URL carries a non-blank query, its node SHALL have the kind `serp` and that query, with surrounding whitespace removed. The query SHALL be read from the URL only. Every other recorded page SHALL have the kind `page` and no query. The same rule SHALL apply however the node is recorded: by a navigation, by a tab joining the group, by a restored tab, or by reconciliation.

#### Scenario: A search in a session tab

- **WHEN** a session tab loads `https://duckduckgo.com/?q=e-bike+mid-drive+motors`
- **THEN** its node has the kind `serp` and the query `e-bike mid-drive motors`

#### Scenario: A search engine page that is not a search

- **WHEN** a session tab loads `https://www.google.com/` or `https://www.google.com/search?q=`
- **THEN** its node has the kind `page` and no query

#### Scenario: A result opened from the search

- **GIVEN** a SERP node in a session tab
- **WHEN** the user follows a result to `https://example.org/motors`
- **THEN** the new node has the kind `page`

#### Scenario: A tab dragged into the group shows a search

- **WHEN** a tab showing `https://www.bing.com/search?q=hub+motor` joins the session's group
- **THEN** its node has the kind `serp` and the query `hub motor`

### Requirement: The first search is the session's root and later searches refine it

The session's earliest SERP node SHALL be its root. WHEN a later SERP node is recorded and its query differs from the root's query, compared case-insensitively with runs of whitespace collapsed, a `refinement` edge from the root to it SHALL be recorded with weight 0.3. A later SERP node with the same query as the root SHALL NOT get a refinement edge. Recording a SERP SHALL NOT change which node is the root.

#### Scenario: A narrower second search

- **GIVEN** the session's root is a SERP for `e-bike motors`
- **WHEN** a session tab loads a SERP for `e-bike mid-drive motors`
- **THEN** a `refinement` edge from the root to the new node is recorded, with weight 0.3

#### Scenario: The next page of the same results

- **GIVEN** the session's root is a SERP for `e-bike motors`
- **WHEN** a session tab loads the second results page for `E-bike  motors`
- **THEN** the new node is a SERP with no refinement edge

#### Scenario: The first search comes after other pages

- **GIVEN** the session has recorded pages but no SERP
- **WHEN** a session tab loads a SERP
- **THEN** that SERP is the session's root and no refinement edge is recorded
