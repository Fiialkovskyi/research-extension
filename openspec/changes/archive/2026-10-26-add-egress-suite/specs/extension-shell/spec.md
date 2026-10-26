# Spec Delta

## ADDED Requirements

### Requirement: The suite checks that the add-on reaches nowhere

The end-to-end suite SHALL record every HTTP request whose triggering or loading principal belongs to the add-on, including requests from its pages, workers and content scripts. It SHALL show that the record sees such a request, and SHALL then assert that a session run with no model install produces none, apart from top-level pages the add-on opens in tabs at the user's request.

#### Scenario: The record sees the add-on's traffic

- **WHEN** a request is made with the add-on's principal
- **THEN** the record lists it

#### Scenario: A whole session reaches nowhere

- **WHEN** the suite starts a session, allows page access, reads pages, opens the Synthesis page, runs a gap's search and opens the options page
- **THEN** the add-on made no request, apart from the search tab it opened
