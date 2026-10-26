# Spec Delta

## Purpose

Defines how the Summaries page names and lists the sources of a statement or a card's value: by site, once for each page, folded until asked for.

## ADDED Requirements

### Requirement: A source is named by its site

A source line's link text SHALL be the page's site name when it gave one, else its host without `www.`; the page's title SHALL be its tooltip, not its text. The day the page was published SHALL follow as before when known.

#### Scenario: A page that gave a site name

- **GIVEN** a page titled `Купити Apple iPhone 17 256GB — ціна | Яблуко` with site name `Яблуко`
- **WHEN** it is cited
- **THEN** the link reads `Яблуко` and its tooltip is the full title

#### Scenario: A page without a site name

- **GIVEN** a page at `https://www.shop.example/p/1` that gave no site name
- **WHEN** it is cited
- **THEN** the link reads `shop.example`

### Requirement: A page is listed once for each statement or value

The citations of one statement, or of one value of a card, SHALL be grouped by page: one line for each page, in order of first appearance, with the first quote and how many more it gave. A quote SHALL still link to its page and be markable wrong.

#### Scenario: Three facts from one page

- **GIVEN** a statement that cites three facts of one page and one of another
- **WHEN** the page is read
- **THEN** it has two source lines, the first saying it gave two more quotes

#### Scenario: Marking one quote wrong

- **GIVEN** a source line that gave three quotes
- **WHEN** the user opens it and marks the second wrong
- **THEN** only that fact is marked wrong

### Requirement: A statement's sources are folded

A statement's sources SHALL be folded under a control that says how many pages there are, and show nothing but the statement until it is opened.

#### Scenario: A statement with sources

- **GIVEN** a statement citing facts of two pages
- **WHEN** the Summaries page is shown
- **THEN** the statement is shown with `Sources (2)` and no quote

#### Scenario: Opening the sources

- **WHEN** the user opens `Sources (2)`
- **THEN** each page's line is shown with its quote and a control to mark it wrong
