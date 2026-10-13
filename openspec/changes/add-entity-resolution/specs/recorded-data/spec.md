# Spec Delta

## ADDED Requirements

### Requirement: The user can see and separate a session's entities

The "What was recorded" page SHALL list the session's entities, each with its name, its type, how many facts and pages it holds, and the names merged into it. Each merged name SHALL offer "Separate", which undoes that merge. Entity names SHALL be shown decrypted only on this page.

#### Scenario: A merged entity

- **GIVEN** an entity "MacBook Neo 13" holding 12 facts from 2 pages, with "Apple MacBook Neo 13 A18 Pro" merged into it
- **WHEN** the user opens "What was recorded"
- **THEN** the entity is listed with those counts and the merged name

#### Scenario: Separating

- **WHEN** the user chooses "Separate" on a merged name
- **THEN** that name is listed as an entity of its own

#### Scenario: No entities

- **GIVEN** a session without extracted facts
- **THEN** the page says no entities were found yet

## MODIFIED Requirements

### Requirement: Deleting a page deletes everything derived from it

WHEN the user deletes a page, the extension SHALL remove in one transaction the page's node, every edge touching it, its snapshot, its chunks, its vectors in every space, its facts and its pending jobs, and SHALL remove every entity left without facts, and SHALL then recluster the session. Pages reached from it SHALL keep their own records.

#### Scenario: Deleting a deep-read page

- **GIVEN** page A with a snapshot, chunks, vectors, facts and an opener edge to page C
- **WHEN** the user deletes A
- **THEN** no node, edge, snapshot, chunk, vector, fact or job of A remains
- **AND** C is still recorded, at the top level of the tree

#### Scenario: An entity only page A mentioned

- **GIVEN** an entity whose facts all came from page A, and one with facts from A and B
- **WHEN** the user deletes A
- **THEN** the first entity is gone and the second keeps B's facts

### Requirement: Deleting a session deletes all of it

WHEN the user deletes a session, the extension SHALL remove in one transaction every record carrying that session's id — nodes, edges, snapshots, chunks, vectors, facts, entities, jobs and its clustering — and the session itself. Its tab group SHALL stay open and SHALL no longer be followed.

#### Scenario: Deleting the active session

- **GIVEN** the active session with pages, snapshots, vectors, facts and entities
- **WHEN** the user deletes it
- **THEN** no record of it remains in any store
- **AND** its tab group is still open, and the popup offers to start a session
