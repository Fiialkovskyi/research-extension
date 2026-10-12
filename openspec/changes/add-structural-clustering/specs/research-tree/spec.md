# Spec Delta

## ADDED Requirements

### Requirement: The tree groups pages by cluster

WHEN the active session has been clustered into more than one cluster, the popup's tree SHALL show each cluster that holds two or more pages as a top-level row named by the cluster's label and its number of pages, with that cluster's pages arranged under it as the tree arranges them. Cluster rows SHALL be in the order their first pages were recorded. Pages in clusters of one SHALL be gathered under a single top-level row named `Unclustered`, after the cluster rows. A cluster row SHALL be expandable and collapsible like any other row and SHALL NOT select a tab. WHEN the session has not been clustered or has one cluster, the tree SHALL be shown ungrouped.

#### Scenario: Two threads

- **GIVEN** the session is clustered into `e-bike motors` with 3 pages and `battery range` with 2 pages, and one lone page
- **WHEN** the user opens the popup
- **THEN** the tree's top level is `e-bike motors · 3`, `battery range · 2` and `Unclustered · 1`, in that order
- **AND** each holds its pages nested as before

#### Scenario: Before clustering

- **GIVEN** a session that has not been clustered yet
- **WHEN** the user opens the popup
- **THEN** the tree is shown ungrouped
