# Spec Delta

## Purpose

Lets the user see everything the extension recorded for a session — pages, signals, page text and
vectors — and delete a page or the whole session, with every derived record going with it.

## ADDED Requirements

### Requirement: The user can see what a session recorded

WHILE a session is active or closed, the popup SHALL offer a "What was recorded" page. The page SHALL list every page of that session with its title, URL, when it was recorded, its signals — active reading time, scroll depth, copies, focus count, revisits and quick returns — whether a snapshot of its text exists with its size, and how many vectors it has. The snapshot's text SHALL be shown only when the user asks for it, decrypted. The page SHALL make no network request.

#### Scenario: A deep-read page

- **GIVEN** the session recorded page A, read for 2 minutes, scrolled to 80%, copied from once, with a 12 KB snapshot and 4 vectors
- **WHEN** the user opens "What was recorded"
- **THEN** A's entry shows those values
- **AND** choosing to show its text displays the article text

#### Scenario: No session

- **GIVEN** no session is active or closed
- **THEN** the popup does not offer "What was recorded", and the page, opened directly, says there is nothing to show

### Requirement: Deleting a page deletes everything derived from it

WHEN the user deletes a page, the extension SHALL remove in one transaction the page's node, every edge touching it, its snapshot, its chunks, its vectors in every space and its pending jobs, and SHALL then recluster the session. Pages reached from it SHALL keep their own records.

#### Scenario: Deleting a deep-read page

- **GIVEN** page A with a snapshot, chunks, vectors and an opener edge to page C
- **WHEN** the user deletes A
- **THEN** no node, edge, snapshot, chunk, vector or job of A remains
- **AND** C is still recorded, at the top level of the tree

### Requirement: Deleting a session deletes all of it

WHEN the user deletes a session, the extension SHALL remove in one transaction every record carrying that session's id — nodes, edges, snapshots, chunks, vectors, jobs and its clustering — and the session itself. Its tab group SHALL stay open and SHALL no longer be followed.

#### Scenario: Deleting the active session

- **GIVEN** the active session with pages, snapshots and vectors
- **WHEN** the user deletes it
- **THEN** no record of it remains in any store
- **AND** its tab group is still open, and the popup offers to start a session

### Requirement: Deletion is confirmed first

A delete control SHALL NOT delete on its first activation. It SHALL first show a confirmation naming what will be deleted, and SHALL delete only when that confirmation is chosen; dismissing it SHALL delete nothing.

#### Scenario: Changing one's mind

- **WHEN** the user chooses to delete page A and then cancels
- **THEN** A and everything derived from it are still recorded
