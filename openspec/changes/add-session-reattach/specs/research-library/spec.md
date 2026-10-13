# Spec Delta

## ADDED Requirements

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
