# research-graph Specification

## Purpose
TBD - created by archiving change add-graph-store. Update Purpose after archive.

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
