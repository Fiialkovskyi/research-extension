# Spec Delta

## MODIFIED Requirements

### Requirement: The user can see what a session recorded

WHILE a session is active or closed, the popup SHALL offer a "What was recorded" page. The page SHALL list every page of that session with its title, URL, when it was recorded, its signals — active reading time, scroll depth, copies, focus count, revisits and quick returns — whether a snapshot of its text exists with its size, how many vectors it has, and how many facts were extracted from it and how many were dropped as ungrounded. The snapshot's text SHALL be shown only when the user asks for it, decrypted. WHILE a text-generation model is active, the page SHALL offer "Extract facts now" for the session. The page SHALL make no network request.

#### Scenario: A deep-read page

- **GIVEN** the session recorded page A, read for 2 minutes, scrolled to 80%, copied from once, with a 12 KB snapshot, 4 vectors, 7 facts and 2 dropped facts
- **WHEN** the user opens "What was recorded"
- **THEN** A's entry shows those values
- **AND** choosing to show its text displays the article text

#### Scenario: No session

- **GIVEN** no session is active or closed
- **THEN** the popup does not offer "What was recorded", and the page, opened directly, says there is nothing to show

#### Scenario: Asking for facts

- **GIVEN** an active text-generation model and a session with deep-read pages not yet extracted
- **WHEN** the user chooses "Extract facts now"
- **THEN** extraction of the session's pages starts while the user is active
- **AND** the page's fact counts update as pages finish

#### Scenario: No generation model

- **GIVEN** no active text-generation model
- **WHEN** the user opens "What was recorded"
- **THEN** "Extract facts now" is not offered

### Requirement: Deleting a page deletes everything derived from it

WHEN the user deletes a page, the extension SHALL remove in one transaction the page's node, every edge touching it, its snapshot, its chunks, its vectors in every space, its facts and its pending jobs, and SHALL then recluster the session. Pages reached from it SHALL keep their own records.

#### Scenario: Deleting a deep-read page

- **GIVEN** page A with a snapshot, chunks, vectors, facts and an opener edge to page C
- **WHEN** the user deletes A
- **THEN** no node, edge, snapshot, chunk, vector, fact or job of A remains
- **AND** C is still recorded, at the top level of the tree

### Requirement: Deleting a session deletes all of it

WHEN the user deletes a session, the extension SHALL remove in one transaction every record carrying that session's id — nodes, edges, snapshots, chunks, vectors, facts, jobs and its clustering — and the session itself. Its tab group SHALL stay open and SHALL no longer be followed.

#### Scenario: Deleting the active session

- **GIVEN** the active session with pages, snapshots, vectors and facts
- **WHEN** the user deletes it
- **THEN** no record of it remains in any store
- **AND** its tab group is still open, and the popup offers to start a session
