# research-clusters Specification

## Purpose

Defines how the pages of a research session are grouped into clusters from the relations capture
records, without any model: what goes in, how dead ends are placed, how a cluster keeps its identity
across recomputes, when recompute runs, and what each result records.

## Requirements

### Requirement: The session is clustered from its recorded relations

The extension SHALL group the active session's pages into clusters by community detection over its recorded edges, each edge counting by its stored weight, with no model installed. Pages that are not dead ends SHALL take part in detection; a page with no relation to any other SHALL be a cluster of its own. The same graph SHALL always give the same clusters.

#### Scenario: Two threads of research

- **GIVEN** a search that opened results A and B, and a second, unrelated search that opened results C and D
- **WHEN** the session is clustered
- **THEN** the first search, A and B share one cluster, and the second search, C and D another

#### Scenario: Compared pages belong together

- **GIVEN** pages A and B from different searches, joined by a co-attention edge, and each with no other relation
- **WHEN** the session is clustered
- **THEN** A and B share a cluster

#### Scenario: Same input, same clusters

- **WHEN** the same graph is clustered twice
- **THEN** both results group the pages identically

### Requirement: Dead ends join the cluster they were reached from

A dead-end page SHALL NOT take part in detection. It SHALL join the cluster of the page it was reached from — the previous page in its tab, or else the page that opened its tab — and SHALL be a cluster of its own when that page has none.

#### Scenario: A result abandoned at once

- **GIVEN** result P, a dead end, opened from a search in cluster K
- **WHEN** the session is clustered
- **THEN** P is in cluster K

### Requirement: A cluster keeps its identity as the session grows

WHEN the session is clustered again, each new cluster SHALL keep the id of the previous cluster with which it shares the most pages, provided they share at least one; no previous id SHALL be given to two new clusters. A cluster sharing no page with any previous cluster SHALL get a new id.

#### Scenario: A page joins a thread

- **GIVEN** cluster K holds a search, A and B
- **WHEN** a link from B leads to page E, and the session is clustered again
- **THEN** the cluster holding the search, A, B and E has K's id

### Requirement: Clusters are recomputed after the graph changes, and say how

The extension SHALL recluster the active session 5 seconds after the last change to its graph, at most once per quiet period, and when the background reconciles the session at start-up. Each result SHALL record the algorithm version and the clustering configuration version that produced it, and each cluster a label: the query of its earliest search, or else the title of its earliest page. A recompute for 300 pages SHALL take under 200 ms.

#### Scenario: A burst of navigation

- **WHEN** the user opens five pages within three seconds
- **THEN** the session is clustered once, about 5 seconds after the fifth

#### Scenario: Provenance

- **WHEN** a clustering is stored
- **THEN** it records `louvain@1` and `cluster_config@1`
