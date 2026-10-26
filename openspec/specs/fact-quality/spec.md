# fact-quality Specification

## Purpose

Defines what the fact extractor is told about the page it reads, which facts it drops as implausible, how spellings of one attribute merge, and when several values are options rather than a conflict.

## Requirements

### Requirement: The extractor is told what the page is

Each request to extract facts SHALL say, as data and not as instruction, which page the passage comes from: its title, its site and, when known, its product, each cut to a fixed length. The instructions SHALL say that facts about the page's main product, when the passage does not name it, belong to that product; that a value, a number with a unit or a feature name is never a subject; and that figures of a table comparing several models belong to the model whose column states them or are left out. The context SHALL be delimited so that the page cannot end it, and the prompt's version SHALL be recorded on every fact.

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
- **THEN** each fact records `factExtraction@2`

### Requirement: Implausible subjects are dropped

A fact whose subject is empty, only digits and punctuation, equal to the fact's own value, or a number followed by a unit of measure SHALL NOT be kept, and SHALL be counted as dropped. A subject that merely begins with a number, such as a brand name, SHALL be kept.

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

The comparison table SHALL give attributes that name the same thing in Ukrainian, Russian or English — such as `діафрагма` and `aperture` — one column, labelled by its most frequent spelling. An attribute not in the bundled table SHALL keep its own column.

#### Scenario: Two languages, one column

- **GIVEN** one fact with attribute `діафрагма` and another with attribute `aperture`
- **WHEN** the table is read
- **THEN** it has one column for both

#### Scenario: An attribute nobody listed

- **GIVEN** a fact with attribute `fingerprint reader position`
- **WHEN** the table is read
- **THEN** it has its own column

### Requirement: A conflict needs two pages

A cell of the comparison table SHALL be a conflict only when at least two different pages give different values. Different values from a single page, and values of a variant attribute such as storage or colour, SHALL be shown together as options, not as a conflict, with every value keeping its sources.

#### Scenario: One page lists several models

- **GIVEN** one page states the screen as `6,1″`, `6,3″` and `6,9″`
- **WHEN** the table is read
- **THEN** the cell is not a conflict and shows the three values as options

#### Scenario: Variants of storage

- **GIVEN** two pages state storage `128GB`, `256GB` and `512GB`
- **WHEN** the table is read
- **THEN** the cell is not a conflict and shows the values as options

#### Scenario: Two shops disagree

- **GIVEN** two pages give the weight of one product as `23.5 kg` and `24 kg`
- **WHEN** the table is read
- **THEN** the cell is a conflict

### Requirement: Columns that say nothing are not proposed

The proposed columns SHALL leave out generic attributes (such as description, design and type) and, when the table has more than one row, attributes that only one row has; they stay among the other columns the user can add. Columns the user saved SHALL be shown as saved.

#### Scenario: A generic attribute

- **GIVEN** facts with the attribute `description`
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
