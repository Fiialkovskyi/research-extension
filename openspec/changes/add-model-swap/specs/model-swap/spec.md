# Spec Delta

## Purpose

Defines what happens when the active embedding or text-generation model changes: a session moves to a new embedding space only once that space is complete, old spaces are kept for a while and can be removed, and statements already generated stay as they are, labelled with their producer, until their inputs change or the user asks.

## ADDED Requirements

### Requirement: A session switches embedding space only when the new one is complete

WHEN the active embedding model differs from the one behind the active session's space, the session SHALL keep using its current space until every chunk of the session has a vector in the active model's space, and SHALL then switch to it in one write. The space it left SHALL be marked retired unless another session uses it.

#### Scenario: Halfway through re-embedding

- **GIVEN** a session in space A, and a newly active model whose space B covers 3 of the session's 5 chunks
- **WHEN** similarity or clustering runs
- **THEN** it uses space A

#### Scenario: Re-embedding complete

- **WHEN** space B covers all 5 chunks
- **THEN** the session's space is B, and A is retired

### Requirement: Retired spaces are kept for 14 days or until removed

A retired space's vectors SHALL be kept until the user removes the space or 14 days pass after it was retired, whichever comes first. The options page SHALL list each space with its model, vector count, approximate size, and whether it is in use or retired and since when, and SHALL offer "Remove" for a retired space.

#### Scenario: Removing a retired space

- **WHEN** the user removes a retired space
- **THEN** its vectors are deleted and it is listed as removed

#### Scenario: Fourteen days later

- **GIVEN** a space retired 15 days ago
- **WHEN** the background starts or wakes for jobs
- **THEN** its vectors are deleted

#### Scenario: A space in use

- **THEN** it offers no "Remove"

### Requirement: A generation model swap leaves existing statements in place

WHEN the active text-generation model changes, existing facts, summaries and questions SHALL remain visible and SHALL be labelled with the model that produced them. They SHALL be regenerated only when the user asks or their inputs change. Pages never extracted SHALL be extracted with the active model.

#### Scenario: Activating another generation model

- **GIVEN** summaries written by model M
- **WHEN** model N becomes the active generation model
- **THEN** the summaries remain, labelled as written by M, and no extraction, summary or question job is queued for them

#### Scenario: Asking for a refresh

- **WHEN** the user chooses "Refresh" on a summary written by M while N is active
- **THEN** a new summary is written by N

#### Scenario: A new page after the swap

- **WHEN** a page is read deeply after N became active
- **THEN** its facts are extracted by N
