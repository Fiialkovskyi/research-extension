# Spec Delta

## ADDED Requirements

### Requirement: The types a page declares are read and stored

The page observer SHALL also read, from the JSON-LD scripts it already reads within their limits, the `@type` names its graph declares — at most 8, each cut to 40 characters, de-duplicated — and the page's `og:type`, and the background SHALL store them with the page's metadata. A page that declares none SHALL have none stored. Nothing about them SHALL be read from the page's text.

#### Scenario: Types of a graph

- **GIVEN** a page whose JSON-LD declares a `Product` and, within it, an `Offer` and a `Review`
- **WHEN** its metadata is read
- **THEN** the stored types name `Product`, `Offer` and `Review`

#### Scenario: A page that declares none

- **GIVEN** a page with no JSON-LD and no `og:type`
- **WHEN** its metadata is read
- **THEN** it has no types stored

#### Scenario: Too many types

- **GIVEN** a graph declaring twelve types
- **WHEN** its metadata is read
- **THEN** at most eight are stored
