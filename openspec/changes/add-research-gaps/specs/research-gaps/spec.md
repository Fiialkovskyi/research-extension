# Spec Delta

## Purpose

Defines research gaps: what a session has not found yet — attributes missing for the things it compares, and kinds of source it has not read — each with a search the user can run inside the session with one action.

## ADDED Requirements

### Requirement: Empty cells of confirmed entities are gaps

For the comparison table's current type and columns, each empty cell of a confirmed entity SHALL be a gap naming the entity and the attribute. An entity SHALL be confirmed WHEN facts about it come from at least two pages. At most 20 cell gaps SHALL be listed, with the count of the rest.

#### Scenario: A missing price

- **GIVEN** a confirmed entity "MacBook Neo 13" with no fact for the column price
- **WHEN** gaps are read
- **THEN** "No price for MacBook Neo 13" is a gap

#### Scenario: An entity seen on one page

- **GIVEN** an entity whose facts all come from one page
- **THEN** none of its empty cells is a gap

### Requirement: Source categories not yet visited are gaps

Each page SHALL be sorted by its host into a source category from a bundled, versioned table: review, forum, video, retailer, reference, news or other. Each of review, forum, video, retailer and reference that no page of the session falls into SHALL be a gap.

#### Scenario: Only shops visited

- **GIVEN** a session whose pages are all on retailer hosts
- **WHEN** gaps are read
- **THEN** reviews, forums, videos and reference pages are listed as not visited

#### Scenario: An unknown host

- **GIVEN** a page on a host the table does not know
- **THEN** it counts as other and fills no category

### Requirement: Search this runs a gap's query inside the session

Each gap SHALL carry a query: for a cell, the entity's name and the attribute; for a category, the session's most frequent entity, or its title when it has none, followed by a word for the category. "Search this" SHALL open the query's results page, on the search engine the session's searches used most or DuckDuckGo when it has none, in a new tab in the session's tab group. The extension SHALL make no request of its own to do so.

#### Scenario: Searching a missing price

- **GIVEN** the gap "No price for MacBook Neo 13" in a session whose searches used Google
- **WHEN** the user chooses "Search this"
- **THEN** a new tab in the session's group opens Google's results for "MacBook Neo 13 price"
- **AND** the search is recorded in the session like any other

#### Scenario: A session with no searches

- **WHEN** the user chooses "Search this" in a session with no recorded search
- **THEN** the results page is DuckDuckGo's

### Requirement: Gaps are shown on the Synthesis page

The Synthesis page SHALL show the gaps below the comparison table, each with "Search this", computed when the page is read. WHEN there are none, it SHALL say so.

#### Scenario: No gaps

- **GIVEN** a session whose confirmed entities have every shown column and that visited every category
- **WHEN** the user opens Synthesis
- **THEN** the gaps section says nothing is missing
