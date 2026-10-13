# research-library Specification

## Purpose

Lets the user put a research session aside and come back to it: saving closes its tabs and keeps
everything recorded, the library lists saved sessions, and resuming reopens the session's tabs
lazily where the user left off.

## Requirements

### Requirement: The user saves a session

WHILE a session is active, the popup SHALL offer "Save research". Saving SHALL first have the session's open pages send their pending signals and bring reading time up to date; it SHALL then record the page the user was on, with how far it was read, record the session's tabs in order with each tab's URL and page, close the session's pages, mark the session saved, and close its tabs — opening a new tab first when they were all the tabs of their window. It SHALL complete within 2 seconds for a session of 100 pages.

#### Scenario: Saving

- **GIVEN** the active session `E-bike motors` with three tabs, the user reading page B
- **WHEN** the user chooses "Save research"
- **THEN** the session is saved with its three tabs in order and B as where the user left off
- **AND** its tabs are closed and no session is active

#### Scenario: Signals are not lost

- **GIVEN** the user scrolled page B a moment before saving
- **WHEN** the session is saved
- **THEN** B's node records that scroll

#### Scenario: The session's tabs were the whole window

- **GIVEN** a window holding only the session's tabs
- **WHEN** the session is saved
- **THEN** the window stays open with a new tab

### Requirement: The library lists saved sessions

WHEN no session is active, the popup SHALL list the saved sessions, newest first, each with its title, when it was saved, how many pages it recorded and the page the user left off at, with "Resume" and a delete control that asks for confirmation.

#### Scenario: Two saved sessions

- **GIVEN** sessions `Batteries` saved yesterday and `E-bike motors` saved today
- **WHEN** the user opens the popup with no active session
- **THEN** it lists `E-bike motors` before `Batteries`, each with its page count and where it was left off

### Requirement: The user resumes a saved session

Resuming SHALL be refused while another session is active, and SHALL end a closed session as starting one does. It SHALL recreate a tab group with the session's title holding the saved tabs in their saved order; every tab but the left-off page SHALL open without loading, and the left-off page SHALL open loaded and selected. The session's saved pages SHALL be reopened on the new tabs rather than recorded again, and the session SHALL become active, following the new group.

#### Scenario: Resuming

- **GIVEN** the saved session `E-bike motors` with tabs A, B and C, left off at B
- **WHEN** the user chooses "Resume"
- **THEN** a group `E-bike motors` holds tabs A, B and C in that order, B loaded and selected, A and C not loaded
- **AND** the session is active with the same three pages and no new ones

#### Scenario: Another session is active

- **GIVEN** the active session `Batteries`
- **WHEN** the user tries to resume `E-bike motors`
- **THEN** resuming is refused and no tab is opened

### Requirement: The popup says where the user left off

WHILE a resumed session's left-off page is the one the user is on, the popup SHALL say "You left off at" that page's title, with how much of it was read as a percentage. WHEN the user moves on to another page, it SHALL no longer say so.

#### Scenario: After resuming

- **GIVEN** the session was saved while page B, 40% read, was selected
- **WHEN** the user resumes it and opens the popup
- **THEN** the popup says "You left off at B (40% read)"

### Requirement: A related saved session is offered to continue

WHEN the active session records its first search, the extension SHALL compare that search's query with the first search of each saved session. A saved session SHALL match WHEN their normalised query terms — lowercased, split on whitespace and punctuation other than inner hyphens, without common stop words — overlap by at least 60% (shared terms over all terms), or, WHILE an embedding model is active, WHEN embeddings of the two queries made by that model have a cosine similarity of at least 0.8. The best match SHALL be offered in the popup as a saved session to continue, once per session.

#### Scenario: A narrower search on the same subject

- **GIVEN** the saved session `E-bike motors` whose first search was `e-bike motors`
- **WHEN** a new session's first search is `e-bike mid-drive motors`
- **THEN** the popup offers to continue `E-bike motors`

#### Scenario: An unrelated search

- **GIVEN** the saved session `E-bike motors` whose first search was `e-bike motors`
- **WHEN** a new session's first search is `sourdough starter`
- **THEN** the popup offers nothing

### Requirement: Continuing reattaches the new session to the saved one

WHEN the user chooses to continue, the saved session SHALL become the active session, following the current tab group, which takes its title; every page, relation, snapshot, chunk, vector and job of the new session SHALL become the saved session's, and the new session SHALL be removed, all in one transaction. The saved session's earlier pages SHALL stay in its record, and searches carried over SHALL be linked to its first search as refinements. Its earlier tabs SHALL NOT be reopened.

#### Scenario: Continuing

- **GIVEN** a new session with one search and one page, offered `E-bike motors`
- **WHEN** the user chooses "Continue"
- **THEN** `E-bike motors` is active, its group is the current one titled `E-bike motors`, and it holds its earlier pages plus the new search and page
- **AND** the new search is a refinement of its first search
- **AND** no record of the new session remains

### Requirement: Declining keeps the sessions apart

WHEN the user chooses to keep the sessions separate, nothing SHALL change but that the offer is not made again for that session.

#### Scenario: Keeping separate

- **WHEN** the user chooses "Keep separate"
- **THEN** both sessions stay as they were, and the popup no longer offers to continue
