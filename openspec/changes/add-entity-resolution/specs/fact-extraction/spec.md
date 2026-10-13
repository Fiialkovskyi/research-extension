# Spec Delta

## ADDED Requirements

### Requirement: A fact records its subject's entity type

A stored fact SHALL record the entity type its answer gave for the fact's subject, encrypted with the rest of the fact's text. A subject the answer did not list, and a fact stored before types were kept, SHALL read as type `unknown`.

#### Scenario: The subject's type is kept

- **GIVEN** an answer listing the entity "Volta E5" with type product, and a fact about "Volta E5"
- **WHEN** the fact is stored
- **THEN** it records the type product, readable only with the data key

#### Scenario: A subject the answer did not list

- **WHEN** a fact's subject is not among the answer's entities
- **THEN** it records the type `unknown`
