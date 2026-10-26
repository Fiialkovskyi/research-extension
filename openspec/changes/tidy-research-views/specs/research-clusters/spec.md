# Spec Delta

## ADDED Requirements

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
