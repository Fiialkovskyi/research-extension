# Spec Delta

## ADDED Requirements

### Requirement: The model may suggest open questions

The extension SHALL let the active text-generation model propose at most 5 open questions about the session, from the session's facts with rejected facts left out, each with a search query. They SHALL be generated no sooner than 60 s after the session's facts change, only while the user is idle or after the user asked, by one run of a versioned prompt, and SHALL be stored only encrypted.

#### Scenario: Questions after reading

- **GIVEN** an active text-generation model and a session whose facts have settled
- **WHEN** the user is idle
- **THEN** at most 5 questions are stored for the session, each with a query

#### Scenario: An answer outside the schema

- **WHEN** the model answers with text outside the prompt's schema
- **THEN** no question is stored

### Requirement: Suggested questions are labelled and searchable

The Synthesis page SHALL list the suggested questions below the gaps, labelled as suggested by the model. Each SHALL offer "Search this", running its query in the session as a gap's search does. A question set whose facts or model changed SHALL be shown as stale, with "Refresh". Without a question set, the page SHALL offer "Suggest questions" while a generation model is active.

#### Scenario: Searching a question

- **WHEN** the user chooses "Search this" on a question
- **THEN** its query opens in a new tab of the session's group

#### Scenario: No generation model

- **GIVEN** no active text-generation model and no question set
- **THEN** the section says questions need a generation model and offers nothing to run

### Requirement: Questions are deleted with their session

WHEN the user deletes a session, its suggested questions SHALL be removed with its other records.

#### Scenario: Deleting the session

- **WHEN** the user deletes a session with suggested questions
- **THEN** none of them remains
