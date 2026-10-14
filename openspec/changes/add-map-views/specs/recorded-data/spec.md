# Spec Delta

## ADDED Requirements

### Requirement: The activity log is deleted with what it describes

Deleting a page SHALL delete its logged reading, copies and pastes; deleting a session SHALL delete its whole activity log.

#### Scenario: Deleting a page

- **WHEN** the user deletes page A
- **THEN** no logged reading, copy or paste of A remains, and other pages' log is unchanged
