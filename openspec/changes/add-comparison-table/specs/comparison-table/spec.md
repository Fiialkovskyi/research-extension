# Spec Delta

## Purpose

Defines the generic comparison table: the session's entities of one type as rows and their most common attributes as columns, each cell a value chosen from the facts with its sources, conflicts between sources flagged, and the whole exportable as CSV with its provenance.

## ADDED Requirements

### Requirement: A table's rows are the entities of one type

The table SHALL list the session's root entities of one type, chosen per table, each with at least one fact. By default the type SHALL be the one with the most such entities. The user SHALL be able to choose any other type the session's entities have.

#### Scenario: The default type

- **GIVEN** a session with 4 entities of type product, 2 of type company and 1 of type unknown
- **WHEN** the table is shown
- **THEN** its rows are the 4 products, and product, company and unknown can be chosen

#### Scenario: Merged entities are one row

- **GIVEN** an entity with another merged into it
- **THEN** they are one row, holding the facts of both

### Requirement: Columns are proposed from common attributes and editable

Columns SHALL be proposed from the attributes of the type's facts, compared after normalisation, ordered by how many rows have them, at most 8 at first. The user SHALL be able to remove a column and add any other attribute of the type. The chosen columns SHALL be kept per session and type, and SHALL be stored only encrypted.

#### Scenario: Proposed columns

- **GIVEN** products whose facts have "weight" for 4 rows, "Price" and "price" for 3, and "colour" for 1
- **WHEN** the table is first shown
- **THEN** its columns are weight, price and colour, in that order

#### Scenario: Editing columns

- **WHEN** the user removes "colour" and adds "battery capacity"
- **THEN** the table shows weight, price and battery capacity
- **AND** shows the same columns when opened again

### Requirement: A cell shows a chosen value and its alternatives

A cell SHALL group its row's facts for its column into values that agree. Numbers agree WHEN their normalised units are equal and they differ by at most 5% of the larger. Text agrees WHEN it is equal after normalisation. The cell SHALL show the value of the group with the most facts, with a count of the other groups, and SHALL offer its sources: each fact's page and quote.

#### Scenario: Agreeing sources

- **GIVEN** a row's weight facts "23.5 kg", "23.5 kg" and "23 500 g"
- **THEN** the cell shows 23.5 kg with no alternatives and no conflict

#### Scenario: An empty cell

- **GIVEN** a row with no fact for a column
- **THEN** its cell is empty

### Requirement: Disagreeing sources are flagged as a conflict

WHEN a cell's facts form more than one group, the cell SHALL be flagged "conflict" and SHALL list every value with its sources.

#### Scenario: Prices more than 5% apart

- **GIVEN** a row's price facts "1749 USD" from page A and "1999 USD" from page B
- **THEN** the cell is flagged conflict and lists both values, each with its page

#### Scenario: Within tolerance

- **GIVEN** a row's range facts "96 km" and "60 mi"
- **THEN** the values agree, since 60 mi is 96.6 km, and there is no conflict

### Requirement: The table exports to CSV with its sources

"Export CSV" SHALL save a CSV file through a download from the extension page, without any permission beyond those the package declares. Its first column SHALL be the entity, and each attribute column SHALL be followed by a sources column holding the source URLs of that cell. Fields SHALL be quoted per RFC 4180, and a field starting with `=`, `+`, `-` or `@` SHALL be prefixed so that a spreadsheet does not evaluate it.

#### Scenario: Exporting

- **GIVEN** a table with rows Volta and Corsa and the column weight
- **WHEN** the user chooses "Export CSV"
- **THEN** a file downloads with the header `Entity,weight,weight sources` and a row per entity

#### Scenario: A value that looks like a formula

- **WHEN** a value starts with `=`
- **THEN** its field begins with a single quote in the CSV

### Requirement: The table makes no network request and runs no model

Building, showing and exporting the table SHALL make no network request and SHALL NOT run a model.

#### Scenario: Showing the table

- **WHEN** the table is shown and exported
- **THEN** no request leaves the extension and no generation runs

### Requirement: Deleting a session deletes its table settings

WHEN the user deletes a session, its chosen columns SHALL be removed in the same transaction as its other records.

#### Scenario: Deleting the session

- **WHEN** the user deletes a session whose table columns were edited
- **THEN** no column setting of it remains
