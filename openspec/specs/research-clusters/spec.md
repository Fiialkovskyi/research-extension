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

The extension SHALL recluster the active session 5 seconds after the last change to its graph or the last completed embedding job, at most once per quiet period, and when the background reconciles the session at start-up. Each result SHALL record the algorithm version and the clustering configuration version that produced it, and, WHEN semantic edges were used, the embedding space their vectors came from; each cluster SHALL record a label: the query of its earliest search, or else the title of its earliest page. A recompute for 300 pages SHALL take under 200 ms, semantic edges included.

#### Scenario: A burst of navigation

- **WHEN** the user opens five pages within three seconds
- **THEN** the session is clustered once, about 5 seconds after the fifth

#### Scenario: Provenance

- **WHEN** a clustering is stored
- **THEN** it records `louvain@1` and `cluster_config@1`

#### Scenario: Provenance with semantic edges

- **GIVEN** the session has vectors in its embedding space
- **WHEN** it is clustered
- **THEN** the clustering records that space's id

#### Scenario: New vectors

- **WHEN** an embedding job finishes
- **THEN** the session is clustered again about 5 seconds later

### Requirement: Pages with similar content are linked by meaning

WHEN the active session has an embedding space, each page that is not a dead end and has vectors in that space SHALL have a page vector, the normalised mean of its chunks' vectors. Two such pages whose page vectors have a cosine similarity of at least 0.55 SHALL be joined for clustering by a semantic edge of weight 1.2 × (similarity − 0.55) / (1 − 0.55), added to any recorded relation between them. Only vectors of the session's active embedding space SHALL be used; a page without vectors in it SHALL contribute no semantic edge.

#### Scenario: Two articles on one subject, otherwise unrelated

- **GIVEN** articles A and B with no recorded relation — each opened by typing its address — whose page vectors have a similarity of 0.9
- **WHEN** the session is clustered
- **THEN** A and B share a cluster

#### Scenario: Meaning adds to structure, it does not override it

- **GIVEN** a search that opened A, and an unrelated search that opened B, where A and B have a similarity of 0.9
- **WHEN** the session is clustered
- **THEN** a semantic edge joins A and B, weighed together with the recorded relations, and the clusters are those that weighting gives

#### Scenario: Unrelated content

- **GIVEN** pages A and B whose page vectors have a similarity of 0.3, with no recorded relation
- **WHEN** the session is clustered
- **THEN** no semantic edge joins them

#### Scenario: A page without vectors

- **GIVEN** a page with no vectors in the session's space
- **WHEN** the session is clustered
- **THEN** it is clustered from its recorded relations alone

### Requirement: Pages about the same entity are linked

Clustering SHALL join the pages that state facts about the same root entity — one with at least 3 facts — by edges of the weight of a recorded link, as a chain of its pages in the order they were recorded, so an entity on many pages adds one fewer edge than it has pages. No product name, type or language SHALL be consulted, only the entities the session resolved. The session SHALL be clustered again once entity resolution has changed its entities.

#### Scenario: Two pages about one product

- **GIVEN** two pages with no recorded relation, both with facts about the same entity of 3 facts or more
- **WHEN** the session is clustered
- **THEN** they are in one cluster

#### Scenario: An entity with too few facts

- **GIVEN** two pages that share an entity with 2 facts
- **WHEN** the session is clustered
- **THEN** they are not joined by it

#### Scenario: An entity on many pages

- **GIVEN** an entity with facts on 40 pages
- **WHEN** the session is clustered
- **THEN** it adds 39 edges, not 780

#### Scenario: Entities changed

- **WHEN** entity resolution finishes with a changed entity
- **THEN** the session is clustered again

### Requirement: A cluster is named after its main entity

A cluster SHALL be named after the root entity with the most facts among its pages when that entity has at least 3 facts, else as before: its earliest search's query, or its earliest page's title.

#### Scenario: A cluster about one product

- **GIVEN** a cluster whose pages mostly state facts about `Pixel 10a`, with 12 facts
- **WHEN** the clusters are listed
- **THEN** it is named `Pixel 10a`

#### Scenario: No entity

- **GIVEN** a cluster whose entities have fewer than 3 facts
- **WHEN** the clusters are listed
- **THEN** it is named by its earliest search or page as before
