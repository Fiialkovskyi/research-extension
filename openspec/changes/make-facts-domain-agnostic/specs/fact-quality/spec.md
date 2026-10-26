# Spec Delta

## MODIFIED Requirements

### Requirement: The extractor is told what the page is

Each request to extract facts SHALL say, as data and not as instruction, which page the passage comes from: its title, its site and, when known, its product, each cut to a fixed length. The instructions SHALL say that facts about the page's main product, when the passage does not name it, belong to that product; that a value, a number with a unit or a feature name is never a subject; that figures of a table comparing several models belong to the model whose column states them or are left out; and that each fact gives its attribute's concept as a short English noun phrase whatever language the page is in. The context SHALL be delimited so that the page cannot end it, and the prompt's version SHALL be recorded on every fact.

#### Scenario: A passage with the page's context

- **GIVEN** a page titled `Apple iPhone 17 — купити` on the site `Ябко`
- **WHEN** a passage of it is sent to the model
- **THEN** the request names that title and that site as the page's context, apart from the passage

#### Scenario: A title that tries to give orders

- **GIVEN** a page whose title contains the closing delimiter and an instruction
- **WHEN** its passage is sent
- **THEN** the title cannot end the context block, and the instructions still tell the model it is data

#### Scenario: The prompt's version

- **WHEN** facts are kept from a request made with this prompt
- **THEN** each fact records `factExtraction@3`

### Requirement: Implausible subjects are dropped

A fact whose subject is empty, has no letter, is equal to the fact's own value, or begins with a number followed by a unit of measure the extension's value normaliser knows SHALL NOT be kept, and SHALL be counted as dropped. A subject that merely begins with a number, such as a brand name, SHALL be kept. No list of units of its own SHALL be kept for this.

#### Scenario: A screen size as a subject

- **GIVEN** the model answers a fact whose subject is `6,3″ Super Retina XDR`
- **WHEN** the answer is read
- **THEN** the fact is dropped and counted as dropped

#### Scenario: A bare number

- **GIVEN** a fact whose subject is `27`
- **WHEN** the answer is read
- **THEN** it is dropped

#### Scenario: A value as its own subject

- **GIVEN** a fact whose subject is `256GB` and whose value is `256` with unit `GB`
- **WHEN** the answer is read
- **THEN** it is dropped

#### Scenario: A brand that starts with a number

- **GIVEN** a fact whose subject is `3M Scotch`
- **WHEN** the answer is read
- **THEN** it is kept

### Requirement: Spellings of one attribute share a column

The comparison table SHALL give facts whose attributes name the same thing in any language one column, by their concepts: equal concepts always, and, when an embedding model is active, similar ones (see the requirement that concepts that mean the same share a column), labelled by the column's most frequent spelling of the attribute. A concept nobody else shares SHALL keep its own column. No bundled table of attributes SHALL be used.

#### Scenario: Two languages, one column

- **GIVEN** one fact with attribute `діафрагма` and concept `aperture`, and another with attribute `aperture` and concept `aperture`
- **WHEN** the table is read
- **THEN** it has one column for both

#### Scenario: An attribute nobody listed

- **GIVEN** a fact with attribute `fingerprint reader position`
- **WHEN** the table is read
- **THEN** it has its own column

### Requirement: A conflict needs two pages

A cell of the comparison table SHALL be a conflict only when at least two different pages that each state a single value state different ones. Different values from a single page SHALL be shown together as options, not as a conflict, with every value keeping its sources. No list of variant attributes SHALL decide this.

#### Scenario: One page lists several models

- **GIVEN** one page states the screen as `6,1″`, `6,3″` and `6,9″`
- **WHEN** the table is read
- **THEN** the cell is not a conflict and shows the three values as options

#### Scenario: Variants of storage

- **GIVEN** two pages each state storage `128GB`, `256GB` and `512GB`
- **WHEN** the table is read
- **THEN** the cell is not a conflict and shows the values as options

#### Scenario: Two shops disagree

- **GIVEN** two pages give the weight of one product as `23.5 kg` and `24 kg`
- **WHEN** the table is read
- **THEN** the cell is a conflict

### Requirement: Columns that say nothing are not proposed

The proposed columns SHALL leave out concepts whose commonest value is prose and concepts that every entity stating them states with the same value, as the requirement on prose and sameness defines, and, when the table has more than one row, concepts that only one row has; they stay among the other columns the user can add. Columns the user saved SHALL be shown as saved. No list of generic attributes SHALL be used.

#### Scenario: A generic attribute

- **GIVEN** facts with the attribute `description` whose values are more than 8 words
- **WHEN** the columns are proposed
- **THEN** `description` is among the other columns, not the proposed ones

#### Scenario: One row has it

- **GIVEN** a table of three products where only one has the attribute `warranty note`
- **WHEN** the columns are proposed
- **THEN** it is among the other columns

#### Scenario: A single row

- **GIVEN** a table with one row
- **WHEN** the columns are proposed
- **THEN** its attributes are proposed by rank as before
