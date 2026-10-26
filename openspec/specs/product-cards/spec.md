# product-cards Specification

## Purpose

Defines the card the Summaries page shows for each product a cluster's facts describe: what it contains, which entities get one and where its values come from. It is built from stored facts and needs no model.

## Requirements

### Requirement: A cluster shows a card for each product its facts describe

For each cluster, the Summaries page SHALL show a card for each root entity that has at least 3 facts, not counting facts the user marked wrong, and either a fact made from the page's product data or the commonest type, by entity count, among the cluster's entities with at least 3 facts, however that type is named. Cards SHALL be ordered by their fact count and then by name, at most 6 SHALL be shown, and the number of products left out SHALL be said. A card SHALL be made without the model, from the facts as read, so that it changes when a fact changes or is marked wrong, with no summary to regenerate.

#### Scenario: Two products in a cluster

- **GIVEN** a cluster whose facts describe `iPhone 17` with 12 facts and `Pixel 10a` with 8, both typed product
- **WHEN** the Summaries page is read
- **THEN** it shows a card for `iPhone 17` and then one for `Pixel 10a`

#### Scenario: Too few facts

- **GIVEN** an entity of type product with 2 facts
- **WHEN** the page is read
- **THEN** it has no card

#### Scenario: Not a product

- **GIVEN** two products with 4 facts each, an entity of type `company` with 10 facts, and one of type `unknown` with 10 facts
- **WHEN** the page is read
- **THEN** the two products have cards and neither the company nor the unknown has one

#### Scenario: A type named in another language

- **GIVEN** three entities typed `килимок` with 4 facts each and a company with 9
- **WHEN** the page is read
- **THEN** the three have cards and the company has none

#### Scenario: A shop's product of another type

- **GIVEN** an entity with 3 facts, one made from the page's product data, of another type than the cluster's commonest
- **WHEN** the page is read
- **THEN** it has a card

#### Scenario: Nothing to say what it is about

- **GIVEN** only entities of type `unknown` and none with a fact from a page's data
- **WHEN** the page is read
- **THEN** the cluster shows no cards

#### Scenario: More than six products

- **GIVEN** a cluster with eight products that qualify
- **WHEN** the page is read
- **THEN** six cards are shown and the page says two more products were left out

#### Scenario: A fact marked wrong

- **GIVEN** a product with 3 facts, one of which the user marks wrong
- **WHEN** the page is read
- **THEN** the product has no card

### Requirement: A card shows the product's price, key specs and sources

A card SHALL show the product's name, its price with currency when a fact states one, and up to 5 key specs. The price SHALL be the value of the fact made from the page's product data when there is one, else the value the most facts state. Key specs SHALL be chosen from the product's facts by column key, leaving out price, brand, availability and rating and any concept that says nothing (prose, or the same on every product), in the order of how comparable the concepts are in the cluster — stated by more products first, then by more pages, then with the shorter value — with no fixed order of specifications; each shows the value the most facts state, and when one page states several values of it, they are shown together. The price SHALL name its page's site and day when the page gave them, and every value shown SHALL link to its page and quote and SHALL be markable wrong like a citation.

#### Scenario: The price from the page's data

- **GIVEN** `Pixel 10a` has a fact from the page's data with price `24399 UAH` and a model-read fact with price `24 000 грн`
- **WHEN** its card is read
- **THEN** the card's price is `24399 UAH`, with its page's site and day

#### Scenario: Key specs in order

- **GIVEN** three mats where all state `pile height`, two state `colour` and one states `care label`
- **WHEN** a mat's card is read
- **THEN** the card lists pile height, then colour, then care label

#### Scenario: Nothing that says nothing

- **GIVEN** every product states a `description` of more than 8 words and a `category` with the same value
- **WHEN** a card is read
- **THEN** neither is among its key specs

#### Scenario: The commonest value

- **GIVEN** three facts say the battery is `5100 mAh` and one says `5000 mAh`
- **WHEN** the card is read
- **THEN** the battery shows `5100 mAh`

#### Scenario: Variants together

- **GIVEN** one page states storage `128 GB`, `256 GB` and `512 GB`
- **WHEN** the card is read
- **THEN** storage shows the three values together

#### Scenario: A value's source

- **WHEN** a card's value is opened
- **THEN** it shows the page and the quote it was taken from, and a control to mark it wrong

#### Scenario: A product with no price

- **GIVEN** a product whose facts state no price
- **WHEN** its card is read
- **THEN** the card shows its specs and no price
