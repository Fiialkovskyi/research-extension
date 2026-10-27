## ADDED Requirements

### Requirement: The fixtures cover more than one kind of product and language

The committed fixtures SHALL include pages of products that are not electronics and pages in more than one language, so that a rule written for one kind of page is seen failing on another. Each fixture SHALL keep its labels written by hand.

#### Scenario: A page that is not electronics

- **GIVEN** a furniture page among the fixtures
- **WHEN** the evals are run
- **THEN** its facts are extracted and scored like the others, with its own labels

#### Scenario: Another language

- **GIVEN** fixtures in English and in Polish
- **WHEN** the evals are run
- **THEN** the report scores them with the same metrics as the Ukrainian pages
