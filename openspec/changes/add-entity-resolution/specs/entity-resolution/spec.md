# Spec Delta

## Purpose

Defines how the facts a session extracted are grouped into entities — one per real thing however each page names it — how those merges are recorded and undone, and how fact values are read into comparable units for synthesis.

## ADDED Requirements

### Requirement: Every fact belongs to an entity of its session

WHEN a page's fact extraction finishes, each of its facts SHALL be assigned an entity of the same session: an existing entity it matches, or a new one named by its subject with its subject's type. Entities SHALL NOT be shared across sessions.

#### Scenario: A new subject

- **GIVEN** a session with no entities
- **WHEN** a page's extraction stores facts about "Volta E5", a product
- **THEN** the session has one entity "Volta E5" of type product, holding those facts

#### Scenario: Another session

- **GIVEN** an entity "Volta E5" in session 1
- **WHEN** session 2 extracts a fact about "Volta E5"
- **THEN** session 2 gets an entity of its own

### Requirement: Entities match by normalised name first

Two subjects SHALL be the same entity WHEN their names are equal after Unicode compatibility normalisation, case folding, removal of quotes and punctuation, and collapsing of whitespace, and their types are equal or one of them is `unknown`.

#### Scenario: Written differently

- **GIVEN** an entity `MacBook Neo 13"` of type product
- **WHEN** a fact's subject is `macbook neo 13` of type product
- **THEN** the fact joins that entity

#### Scenario: Same name, different type

- **GIVEN** an entity "Apple" of type company
- **WHEN** a fact's subject is "Apple" of type fruit
- **THEN** it does not join that entity

### Requirement: Entities match by meaning only within one type

WHEN no entity matches by name and an embedding model is active, a subject SHALL join the most similar entity of the same type whose name's embedding similarity is at least 0.85 in the active embedding space. Without an active embedding model, only name matching SHALL apply.

#### Scenario: Similar names of one type

- **GIVEN** an entity "Apple MacBook Neo 13 A18 Pro" of type product, and an active embedding model rating "MacBook Neo 13" at 0.91 against it
- **WHEN** a fact's subject is "MacBook Neo 13" of type product
- **THEN** the fact's entity is merged into "Apple MacBook Neo 13 A18 Pro"

#### Scenario: Below the threshold

- **WHEN** the most similar entity of the same type rates 0.80
- **THEN** the subject becomes a new entity

#### Scenario: No embedding model

- **GIVEN** no active embedding model
- **WHEN** a subject matches no entity by name
- **THEN** it becomes a new entity, and no embedding is computed

### Requirement: Merges are reversible

A match by meaning SHALL be recorded as one entity merged into another, keeping both. The user SHALL be able to separate a merged entity, after which its facts belong to it alone and it SHALL NOT be merged by meaning into the same entity again.

#### Scenario: Separating a wrong merge

- **GIVEN** "MacBook Neo 13" merged into "MacBook Air 13"
- **WHEN** the user separates "MacBook Neo 13"
- **THEN** the two are separate entities, each with its own facts
- **AND** a later extraction does not merge them again

### Requirement: Entity names are encrypted at rest

An entity's name and the names merged into it SHALL be stored only encrypted with the data key. An entity's session, type of record and fact count SHALL be readable without it.

#### Scenario: Reading the store directly

- **WHEN** the entities store is read without the data key
- **THEN** no entity's name is readable

### Requirement: Values are normalised into comparable units

A fact's value SHALL be readable, by a versioned normaliser, as a number in a base unit when its value is numeric and its unit is known: mass in kg, length in mm, distance in km, energy in Wh, power in W, torque in N·m, time in s. A decimal comma and thousands separators SHALL be read as written. Percentages and currencies SHALL keep their unit without conversion. A value that cannot be read SHALL have no normalised form.

#### Scenario: Mass in grams

- **WHEN** a fact's value is "1200" with unit "g"
- **THEN** its normalised form is 1.2 kg

#### Scenario: A decimal comma

- **WHEN** a fact's value is "1,2" with unit "кг"
- **THEN** its normalised form is 1.2 kg

#### Scenario: Inches

- **WHEN** a fact's value is "13" with unit "inch"
- **THEN** its normalised form is 330.2 mm

#### Scenario: Not a number

- **WHEN** a fact's value is "Blush"
- **THEN** it has no normalised form
