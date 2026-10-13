# Spec Delta

## Purpose

Lets the user mark a fact wrong once, so that neither the current model nor any later one shows it again in the session's table, summaries or gaps, and lets them undo it.

## ADDED Requirements

### Requirement: A rejection is keyed by the normalised fact

Rejecting a fact SHALL store a rejection keyed by a hash of its subject, attribute and value, each normalised, numbers in their base unit. Facts with equal keys SHALL be rejected together. The store SHALL hold no readable subject, attribute or value.

#### Scenario: The same value written differently

- **GIVEN** facts "Volta E5 · weight · 23.5 kg" and "volta e5 · Weight · 23 500 g"
- **WHEN** the user rejects the first
- **THEN** both are rejected

#### Scenario: Reading the store directly

- **WHEN** the rejections store is read
- **THEN** it holds hashes and times, and no subject, attribute or value

### Requirement: Rejected facts are left out of synthesis

A rejected fact SHALL be left out of the comparison table's cells, the gaps, the CSV export and the facts a summary is built from. A summary's fact set SHALL be computed without rejected facts, so a summary built with one becomes stale. A summary SHALL NOT show a citation of a rejected fact.

#### Scenario: A wrong weight in the table

- **GIVEN** a cell whose values are 23.5 kg from two pages and 2.6 kg from one
- **WHEN** the user rejects 2.6 kg
- **THEN** the cell shows 23.5 kg with no conflict

#### Scenario: A summary citing a rejected fact

- **GIVEN** a summary citing a fact
- **WHEN** the user rejects that fact
- **THEN** the summary is shown stale, without that citation

### Requirement: Later extractions are suppressed too

A fact extracted after a rejection, by any model, whose key equals a rejected key SHALL be left out the same way.

#### Scenario: Another model extracts it again

- **GIVEN** a rejected fact
- **WHEN** a page is extracted again with another model and yields a fact with the same key
- **THEN** that fact is not shown either

### Requirement: Rejections can be undone

The Synthesis page SHALL say how many values of the session were rejected and offer "Restore all", which removes the session's rejections. Rejections SHALL be deleted with their session.

#### Scenario: Restoring

- **GIVEN** two rejections
- **WHEN** the user chooses "Restore all"
- **THEN** the rejected facts are shown again

#### Scenario: Nothing rejected

- **THEN** the page shows no rejection count
