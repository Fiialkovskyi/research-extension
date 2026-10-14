# Spec Delta

## ADDED Requirements

### Requirement: The suite gates the budgets that hold without a model

The end-to-end suite SHALL fail WHEN, in a session tab, the 95th percentile of the time from a navigation to its node being recorded exceeds 1 s over 20 navigations (REQ-NFR-001), or WHEN the extension process, with no model loaded and after memory is minimised, settles above 150 MB (REQ-NFR-003).

#### Scenario: Node latency

- **WHEN** the suite makes 20 navigations in a session tab
- **THEN** the 95th percentile of navigation-to-node time is at most 1 s

#### Scenario: Background memory

- **GIVEN** a session with recorded pages and no model loaded
- **WHEN** the suite minimises memory and samples the extension process
- **THEN** its settled memory is at most 150 MB
