# summary-quality Specification

## Purpose

Defines how the facts of a cluster summary are chosen, what the model is told about them, what a statement must do and which statements are left out when the page is read.

## Requirements

### Requirement: Summary facts are chosen by importance

The facts a cluster summary is built from SHALL be chosen, at most 60, by importance and not only by spread: the price from a page's product data first, then facts of the cluster's most comparable concepts (those stated by more than one product, stated by more products first), then the rest of the page's own data (brand, availability, rating), then facts that more than one page states, then the rest, with at most one fact for each product and attribute before any product gets a second. No fixed order of specifications SHALL be used. No product SHALL be left out while another has more than its share, and the number of facts left out SHALL still be recorded and shown.

#### Scenario: A price and a spec before trivia

- **GIVEN** a cluster of 188 facts, among them a price fact from the page's data, a battery capacity stated by two products, and many facts that only one subject states
- **WHEN** its summary's facts are chosen
- **THEN** the price and both battery capacities are among them

#### Scenario: Specifications before brand and availability

- **GIVEN** a product with a price, a brand, an availability and a rating from its page's data, and a screen resolution that other products state too
- **WHEN** only a few of its facts fit
- **THEN** the price and the screen resolution are chosen before the brand and the availability

#### Scenario: Variants do not fill the list

- **GIVEN** a product with 40 facts that all state its storage
- **WHEN** the facts are chosen
- **THEN** only one or a few of them are chosen before another attribute or product gets a fact

#### Scenario: Every product is represented

- **GIVEN** a cluster of three products, one with 150 facts
- **WHEN** the facts are chosen
- **THEN** each of the three has facts among them

#### Scenario: What was left out is counted

- **WHEN** fewer facts are chosen than the cluster has
- **THEN** the summary records and shows how many were left out

### Requirement: The model is told which product a fact is about

The request for a summary SHALL give each fact with the name of the product it is about — its root entity's name, else its subject — and the prompt (`clusterSummary@2`) SHALL require each statement to name the product it is about, SHALL forbid "the device", "it" and "this product" in place of a name, and, when there are two or more products, SHALL ask for the first statement to be a short comparison of them by price and one or two specs. Statements SHALL still be at most 8 and each SHALL cite a fact, and the prompt's version SHALL be recorded on the summary.

#### Scenario: A fact line names the product

- **GIVEN** a fact whose subject is `Дисплей` and whose root entity is `iPhone 17`
- **WHEN** the request is built
- **THEN** the fact's line names `iPhone 17`, and the quote is as the page wrote it

#### Scenario: The prompt's version

- **WHEN** a summary is written
- **THEN** it records `clusterSummary@2`

#### Scenario: Old summaries still show

- **GIVEN** a summary written with `clusterSummary@1`
- **WHEN** the page is read
- **THEN** it is shown as before, and a refresh writes it with `@2`

### Requirement: Statements that name no product are left out when others do

WHEN the Summaries page is read, a statement that names none of its cluster's products SHALL be left out of the view if at least one other statement does; if none does, all SHALL be shown. Names SHALL be compared normalised, so spelling case and punctuation do not matter. What is stored SHALL NOT change.

#### Scenario: One statement names nothing

- **GIVEN** a summary with statements `iPhone 17 costs 45 999 UAH` and `The device supports video playback`
- **WHEN** the page is read
- **THEN** only the first is shown

#### Scenario: None names a product

- **GIVEN** a summary whose statements name no product
- **WHEN** the page is read
- **THEN** all are shown

#### Scenario: Case and punctuation

- **GIVEN** a statement that says `IPHONE-17` and a product named `iPhone 17`
- **WHEN** the page is read
- **THEN** the statement counts as naming it
