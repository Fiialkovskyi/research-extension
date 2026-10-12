# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
