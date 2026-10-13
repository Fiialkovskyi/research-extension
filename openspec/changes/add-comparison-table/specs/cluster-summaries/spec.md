# Spec Delta

## MODIFIED Requirements

### Requirement: The Summaries page shows each cluster's summary with its sources

WHILE a session is active or closed, the popup SHALL offer "Synthesis", which opens or selects the Synthesis page. The page SHALL list the session's clusters by label. For each, it SHALL show its summary's statements, and each statement's citations as links to their source pages with the quoted text. It SHALL show "Summarize now" for a cluster that has facts but no summary, and SHALL say when a cluster has no facts. Below the summaries, the page SHALL show the session's comparison table. The page SHALL make no network request.

#### Scenario: A summarized cluster

- **GIVEN** a cluster "e-bike motors" with a summary of 3 statements
- **WHEN** the user opens Synthesis
- **THEN** the three statements are listed under "e-bike motors", each with links to the pages and quotes it cites

#### Scenario: Not summarized yet

- **GIVEN** a cluster with facts and no summary
- **WHEN** the user chooses "Summarize now"
- **THEN** its summary is generated while the user is active

#### Scenario: No facts

- **GIVEN** a cluster whose pages have no facts
- **THEN** the page says no facts were extracted for it yet

#### Scenario: The table below the summaries

- **WHEN** the user opens Synthesis
- **THEN** the comparison table follows the summaries on the same page
