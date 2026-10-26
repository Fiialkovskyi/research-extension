# comparable-attributes Specification

## Purpose

Defines how a fact names what it states in a language-independent way, how those names merge into the columns of the comparison table and the key specs of a card, and how columns and key specs are ranked and filtered by what the facts say, with no list of products or attributes.

## Requirements

### Requirement: A fact names its concept in English

Each fact the model extracts SHALL carry a concept: the attribute as a short English noun phrase of at most three words, the same for the same thing whatever language the page is written in. The page's own wording of the attribute SHALL be kept and shown as written. A fact stored without a concept SHALL read as its normalised attribute.

#### Scenario: A page in another language

- **GIVEN** a Ukrainian page that states `Ємність акумулятора: 5100 мА·год`
- **WHEN** its facts are extracted
- **THEN** the fact's attribute is `Ємність акумулятора` and its concept is an English phrase such as `battery capacity`

#### Scenario: A fact without a concept

- **GIVEN** a fact stored before concepts were kept
- **WHEN** the table is read
- **THEN** its column is made from its normalised attribute, as before

### Requirement: Concepts that mean the same share a column

The comparison table and the cards SHALL give facts whose concepts are equal after normalisation one column key, and, when an embedding model is active, facts whose concepts are at least as similar as the merge threshold, represented by the commonest concept. A merge SHALL NOT chain: a concept joins a group only through its representative. Without an embedding model, or when it fails, only equal concepts SHALL merge, and a concept nobody else shares SHALL keep its own column. Only the concept labels SHALL be embedded, never page text. No list of products, attributes or languages SHALL decide a merge.

#### Scenario: Equal concepts from two languages

- **GIVEN** a Ukrainian fact with attribute `Діафрагма` and concept `aperture`, and an English fact with attribute `Aperture` and concept `aperture`
- **WHEN** the table is read
- **THEN** it has one column for both

#### Scenario: Near synonyms, with an embedding model

- **GIVEN** an embedding model is active and two facts have the concepts `colour` and `color`
- **WHEN** the table is read
- **THEN** they share one column, labelled by the commoner

#### Scenario: Different things stay apart

- **GIVEN** an embedding model is active and two facts have the concepts `battery life` and `battery capacity`
- **WHEN** the table is read
- **THEN** they have two columns

#### Scenario: No embedding model

- **GIVEN** no embedding model is active and two facts have the concepts `colour` and `color`
- **WHEN** the table is read
- **THEN** they have two columns

#### Scenario: Only labels are embedded

- **WHEN** concepts are merged
- **THEN** the texts sent to the embedding model are the concept labels and nothing from a page

#### Scenario: A thing nobody listed

- **GIVEN** a bath mat's fact with the concept `pile height`
- **WHEN** the table is read
- **THEN** it has its own column

### Requirement: Columns and key specs are ranked by how comparable they are

The proposed columns of a table, the key specs of a card and the order in which facts are chosen for a summary SHALL rank a concept by the number of distinct root entities that state it, then by the number of distinct pages, then by the shorter commonest value, then by key. Facts from a page's own product data SHALL still come first. No fixed order of specifications SHALL be used.

#### Scenario: What several products share comes first

- **GIVEN** three products where all state `pile height` and one states `care label`
- **WHEN** the columns are proposed
- **THEN** `pile height` comes before `care label`

#### Scenario: A single product

- **GIVEN** a cluster with one product whose facts state `weight` on three pages and `colour` on one
- **WHEN** its key specs are chosen
- **THEN** `weight` comes before `colour`

### Requirement: Prose and what does not tell products apart are not specs

A concept SHALL NOT be a proposed column or a key spec when its commonest value is more than 8 words, or when it is stated by two or more entities, all with the same value. It SHALL stay among the other columns. A concept stated by only one entity in a table of several rows SHALL be left out of the proposed columns and of the key specs chosen for a summary as before; a card MAY still show it after the shared ones. These SHALL be decided from the facts, not from a list of words.

#### Scenario: A description

- **GIVEN** every product states a `description` of more than 8 words
- **WHEN** the columns are proposed
- **THEN** `description` is among the other columns

#### Scenario: The same on every row

- **GIVEN** three products all state `category` as `bath mat`
- **WHEN** the columns are proposed
- **THEN** `category` is among the other columns

#### Scenario: A value that tells them apart

- **GIVEN** three products state `pile height` as `12 mm`, `20 mm` and `20 mm`
- **WHEN** the columns are proposed
- **THEN** `pile height` is a proposed column

### Requirement: A card is made for what the research is about

A cluster's card SHALL be made for each root entity with at least 3 facts that has a fact made from the page's product data, or whose entity type is the commonest, by entity count, among the cluster's entities with at least 3 facts, however that type is named. A cluster with neither SHALL show no cards.

#### Scenario: A type named in another language

- **GIVEN** a cluster whose entities with at least 3 facts are mostly typed `килимок`
- **WHEN** the cards are made
- **THEN** each of those entities has a card

#### Scenario: A shop's product

- **GIVEN** an entity with a fact from the page's product data and 3 facts, of another type than the rest
- **WHEN** the cards are made
- **THEN** it has a card

#### Scenario: A company beside products

- **GIVEN** a cluster of three products typed `product` and a company with 4 facts
- **WHEN** the cards are made
- **THEN** the three products have cards and the company has none
