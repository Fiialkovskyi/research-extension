# Spec Delta

## Purpose

Defines the card the Summaries page shows for each product a cluster's facts describe: what it contains, which entities get one and where its values come from. It is built from stored facts and needs no model.

## ADDED Requirements

### Requirement: A cluster shows a card for each product its facts describe

For each cluster, the Summaries page SHALL show a card for each root entity of type `product` that has at least 3 facts, not counting facts the user marked wrong. Cards SHALL be ordered by their fact count and then by name, at most 6 SHALL be shown, and the number of products left out SHALL be said. A card SHALL be made without the model, from the facts as read, so that it changes when a fact changes or is marked wrong, with no summary to regenerate.

#### Scenario: Two products in a cluster

- **GIVEN** a cluster whose facts describe `iPhone 17` with 12 facts and `Pixel 10a` with 8, both typed product
- **WHEN** the Summaries page is read
- **THEN** it shows a card for `iPhone 17` and then one for `Pixel 10a`

#### Scenario: Too few facts

- **GIVEN** an entity of type product with 2 facts
- **WHEN** the page is read
- **THEN** it has no card

#### Scenario: Not a product

- **GIVEN** an entity of type `company` with 10 facts, and one of type `unknown` with 10 facts
- **WHEN** the page is read
- **THEN** neither has a card

#### Scenario: More than six products

- **GIVEN** a cluster with eight products that qualify
- **WHEN** the page is read
- **THEN** six cards are shown and the page says two more products were left out

#### Scenario: A fact marked wrong

- **GIVEN** a product with 3 facts, one of which the user marks wrong
- **WHEN** the page is read
- **THEN** the product has no card

### Requirement: A card shows the product's price, key specs and sources

A card SHALL show the product's name, its price with currency when a fact states one, and up to 5 key specs. The price SHALL be the value of the fact made from the page's product data when there is one, else the value the most facts state. Key specs SHALL be chosen from the product's facts by column key, leaving out price, brand, availability, rating and generic attributes, in a fixed order of importance — screen size, display, battery capacity, storage, memory, camera, processor, charging, weight, water resistance — then the rest by fact count; each shows the value the most facts state, and a variant attribute shows its values together. The price SHALL name its page's site and day when the page gave them, and every value shown SHALL link to its page and quote and SHALL be markable wrong like a citation.

#### Scenario: The price from the page's data

- **GIVEN** `Pixel 10a` has a fact from the page's data with price `24399 UAH` and a model-read fact with price `24 000 грн`
- **WHEN** its card is read
- **THEN** the card's price is `24399 UAH`, with its page's site and day

#### Scenario: Key specs in order

- **GIVEN** `Pixel 10a` has facts for weight, battery capacity, colour, screen size and a feature that is in no order
- **WHEN** its card is read
- **THEN** the card lists screen size, battery capacity, weight and then the other in that order, at most five

#### Scenario: The commonest value

- **GIVEN** three facts say the battery is `5100 mAh` and one says `5000 mAh`
- **WHEN** the card is read
- **THEN** the battery shows `5100 mAh`

#### Scenario: Variants together

- **GIVEN** facts for storage `128 GB`, `256 GB` and `512 GB`
- **WHEN** the card is read
- **THEN** storage shows the three values together

#### Scenario: A value's source

- **WHEN** a card's value is opened
- **THEN** it shows the page and the quote it was taken from, and a control to mark it wrong

#### Scenario: A product with no price

- **GIVEN** a product whose facts state no price
- **WHEN** its card is read
- **THEN** the card shows its specs and no price
