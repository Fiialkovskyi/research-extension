# Spec Delta

## Purpose

Defines the cluster summary: a few statements about what a group of pages says, built by the local text-generation model only from the cluster's grounded facts, each statement citing the facts it rests on, regenerated in the background, and marked stale when it no longer matches what was read.

## ADDED Requirements

### Requirement: A summary is built only from its cluster's facts

A cluster's summary SHALL be generated from the cluster's facts, passed to the model as delimited data, by one model run with a versioned prompt. It SHALL hold at most 8 statements. When the cluster has more than 60 facts, at most 60 SHALL be used, spread across its entities and pages, and the summary SHALL record how many were left out.

#### Scenario: A cluster with facts

- **GIVEN** an active text-generation model and a cluster whose pages have 14 facts
- **WHEN** its summary is generated
- **THEN** it holds at most 8 statements, from one run of `clusterSummary@1`

#### Scenario: A large cluster

- **GIVEN** a cluster with 90 facts
- **WHEN** its summary is generated
- **THEN** 60 facts are used, and the summary records that 30 were left out

### Requirement: Every statement cites facts

Each statement SHALL cite at least one of the facts it was generated from. A citation to a fact that was not among the summary's input SHALL be ignored, and a statement left with no valid citation SHALL be discarded. An answer outside the prompt's schema SHALL be discarded whole.

#### Scenario: A statement citing a fact that was not given

- **WHEN** the model returns a statement citing only a label it was not given
- **THEN** that statement is not stored

#### Scenario: A statement with one valid and one invalid citation

- **WHEN** a statement cites one given fact and one unknown label
- **THEN** it is stored citing the given fact only

### Requirement: Summaries are regenerated when their facts change, on the generation schedule

WHEN a cluster's set of facts changes, a new summary SHALL be generated no sooner than 60 s later, and only while the user is idle or locked or after the user asked for it. A further change within those 60 s SHALL replace the pending generation rather than add one. Generation for a fact set that is no longer the cluster's SHALL NOT run.

#### Scenario: Facts arrive in a burst

- **GIVEN** a cluster whose fact set changes three times within 30 s
- **WHEN** the user is idle afterwards
- **THEN** one summary is generated, from the last fact set, at least 60 s after the last change

#### Scenario: The user is reading

- **GIVEN** a cluster whose fact set changed and a user who is active
- **THEN** no summary is generated until the user is idle or asks

### Requirement: A summary says when it is stale

A summary SHALL be stale WHEN its cluster's current fact set differs from the fact set it was generated from — because a fact was added or removed, or a page was changed or deleted — or WHEN the model that produced it is no longer installed. A stale summary SHALL be shown dimmed, with "Refresh", which asks for a new one.

#### Scenario: A page is deleted

- **GIVEN** a summary citing facts of page A
- **WHEN** the user deletes page A
- **THEN** the summary is shown as stale, with "Refresh"

#### Scenario: The model is removed

- **GIVEN** a summary produced by model M
- **WHEN** M is no longer installed
- **THEN** the summary is shown as stale

### Requirement: Summary text is encrypted at rest

A summary's statements SHALL be stored only encrypted with the data key. Its session, cluster, cited fact ids, input fact-set hash, model and prompt SHALL be readable without it.

#### Scenario: Reading the store directly

- **WHEN** the summaries store is read without the data key
- **THEN** no statement's text is readable

### Requirement: The Summaries page shows each cluster's summary with its sources

WHILE a session is active or closed, the popup SHALL offer "Summaries", which opens or selects the Summaries page. The page SHALL list the session's clusters by label. For each, it SHALL show its summary's statements, and each statement's citations as links to their source pages with the quoted text. It SHALL show "Summarize now" for a cluster that has facts but no summary, and SHALL say when a cluster has no facts. The page SHALL make no network request.

#### Scenario: A summarized cluster

- **GIVEN** a cluster "e-bike motors" with a summary of 3 statements
- **WHEN** the user opens Summaries
- **THEN** the three statements are listed under "e-bike motors", each with links to the pages and quotes it cites

#### Scenario: Not summarized yet

- **GIVEN** a cluster with facts and no summary
- **WHEN** the user chooses "Summarize now"
- **THEN** its summary is generated while the user is active

#### Scenario: No facts

- **GIVEN** a cluster whose pages have no facts
- **THEN** the page says no facts were extracted for it yet

### Requirement: Deleting a session deletes its summaries

WHEN the user deletes a session, its summaries SHALL be removed in the same transaction as its other records.

#### Scenario: Deleting the session

- **GIVEN** a session with summaries
- **WHEN** the user deletes it
- **THEN** no summary of it remains
