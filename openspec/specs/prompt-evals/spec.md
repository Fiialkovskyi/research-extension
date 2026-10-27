# prompt-evals Specification

## Purpose

Defines the fixtures, the runner, the report and the baseline that measure how the extraction and summary prompts behave on real pages with a local model, outside the shipped extension and outside `verify`.

## Requirements

### Requirement: A fixture is a saved page with labels

A fixture SHALL be a directory of `evals/fixtures/<id>/` holding the page's HTML as it was fetched, the page's URL and the day it was saved, and a labels file of the facts a reader would take from it (concept and value), the concept pairs that must be merged and those that must stay apart, and the products it is about. A fixture without labels SHALL be reported and skipped, and not scored.

#### Scenario: A complete fixture

- **GIVEN** a fixture with its HTML, its source and its labels
- **WHEN** the evals run
- **THEN** it is read, run and scored

#### Scenario: No labels

- **GIVEN** a fixture whose labels file is empty
- **WHEN** the evals run
- **THEN** the run names the fixture as skipped and scores the others

#### Scenario: HTML kept out of the repository

- **GIVEN** a fixture that has labels but no HTML on this machine
- **WHEN** the evals run
- **THEN** the run names it as skipped for the missing page

### Requirement: The runner reads a page as the extension does

The runner SHALL give the model what the extension would give it: the page's text and metadata read by the extension's own functions, the chunks, the request with the page context, and the product facts from the page's own data, then check the answer with the extension's own grounding and subject filter, merge concepts, and build the cards and the summary request from the facts of all fixtures together. It SHALL use a local Ollama model named by the developer and SHALL make no request to any other host.

#### Scenario: The same pipeline

- **WHEN** a fixture is run
- **THEN** the request sent to the model is built by `buildFactExtractionMessages` from the page's chunk and its context

#### Scenario: Ollama is not running

- **GIVEN** no Ollama on the loopback
- **WHEN** the evals are started
- **THEN** the run says so and ends without scoring anything

#### Scenario: Only the local model is reached

- **WHEN** the evals run
- **THEN** the only requests made go to the loopback address of Ollama

### Requirement: The run reports numbers

The runner SHALL report, over the fixtures: the share of extraction answers that could not be read and of those cut off by the token limit, the share of answered facts dropped for a junk subject, the share grounded in the page, the recall of the labelled facts, the recall and precision of the concept merges, the share of summary statements that name a product, the number of product cards, and each card's key specs; and the time and the number of requests it took. It SHALL write the report to a file and print a table, and SHALL not decide a pass or a fail from it.

#### Scenario: A report

- **WHEN** a run finishes
- **THEN** a table of the numbers is printed and a report file is written

#### Scenario: Recall of a labelled fact

- **GIVEN** a labelled fact `5100 мАг` and an extracted fact from the same page whose value is `5100` and whose unit is `mAh`
- **WHEN** the labels are matched
- **THEN** the fact counts as found, however the page worded the unit

#### Scenario: Answers the model could not finish

- **GIVEN** an extraction request whose answer stopped at the token limit and so is not valid
- **WHEN** the run is scored
- **THEN** the share of unreadable answers and the share cut off both count it

#### Scenario: A pair that must stay apart

- **GIVEN** the labels say `screen size` and `screen resolution` must stay apart
- **WHEN** the concepts are given their columns and the two share a key
- **THEN** the precision of the merges is lowered

### Requirement: The run is compared with a baseline

The report SHALL show each number beside its value in a committed baseline file, as a difference. The baseline SHALL change only when the developer asks for it with an explicit command. A run SHALL end with success when it could run, whatever the numbers.

#### Scenario: Compared with the baseline

- **GIVEN** a baseline with a recall of 0.8
- **WHEN** a run finds 0.7
- **THEN** the table shows 0.7 and the difference of −0.1

#### Scenario: Updating the baseline

- **WHEN** the run is started with the command that updates the baseline
- **THEN** the baseline file holds this run's numbers

#### Scenario: No baseline yet

- **WHEN** a run is made with no baseline file
- **THEN** the numbers are shown without a difference

### Requirement: The evals are not part of the shipped extension or of `verify`

The evals SHALL live outside `src/`, SHALL NOT be bundled, and SHALL NOT be run by `npm run verify` or `npm run test`. Their pure helpers — matching labels, computing the numbers, formatting the table — SHALL carry unit tests that run with the rest. The extension SHALL gain no network behaviour from them.

#### Scenario: Verify does not need Ollama

- **GIVEN** no Ollama
- **WHEN** `npm run verify` runs
- **THEN** it does not try to run the evals

#### Scenario: The helpers are tested

- **WHEN** `npm run test` runs
- **THEN** the specs of the evals' pure helpers are among those run

### Requirement: A page is captured into a fixture by a development tool

A command SHALL fetch a page's HTML from the developer's machine into a new fixture with its source and day, and a labels template to fill in, and SHALL refuse to replace an existing fixture. It SHALL NOT be part of the extension.

#### Scenario: A new fixture

- **WHEN** the command is given a URL and a new id
- **THEN** the fixture directory holds the page, its source and an empty labels template

#### Scenario: An existing id

- **WHEN** the command is given an id that exists
- **THEN** it changes nothing and says so

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
