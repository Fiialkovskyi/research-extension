# Spec Delta

## Purpose

Defines which research gaps are reported, how they are grouped, and how the kind of a source is found from the page's own data, with no list of hosts.

## ADDED Requirements

### Requirement: A cell gap is reported for a real row and a proposed column

A gap for a missing value SHALL be reported only for a row of the comparison table that has at least 3 facts from at least 2 pages, and only for a column the table proposes. A row below that SHALL have no gaps.

#### Scenario: A confirmed product

- **GIVEN** a row with 4 facts from 2 pages and a proposed column it has no value for
- **WHEN** the gaps are read
- **THEN** that column is reported as missing for it

#### Scenario: A row too thin

- **GIVEN** a row with 2 facts from 2 pages
- **WHEN** the gaps are read
- **THEN** it has no gap

#### Scenario: A column that is not proposed

- **GIVEN** an attribute only one row has, which the table does not propose
- **WHEN** the gaps are read
- **THEN** it is not reported as missing for the other rows

### Requirement: Missing values are one gap for each entity

The missing values of one row SHALL be one gap that names the row and up to 3 of its missing attributes, saying how many more there are, with one search made of the row's name and those attributes. At most 5 such gaps SHALL be listed, the rest counted.

#### Scenario: Several missing values of one product

- **GIVEN** a product missing weight, battery capacity, screen size and colour
- **WHEN** the gaps are read
- **THEN** there is one gap for it naming three attributes and one more, and its search names the product and those three

#### Scenario: Many products

- **GIVEN** eight products that each miss a value
- **WHEN** the gaps are read
- **THEN** five gaps are listed and the page says three more were left out

### Requirement: The kind of a source comes from its page's own data

The kind of a source — shop, review, forum or video — SHALL be read from the schema.org `@type` names of the page's JSON-LD and its `og:type`, stored with the page's metadata, and never from its host. A page with no such signal SHALL be unclassified. No bundled list of hosts SHALL be used.

#### Scenario: A shop

- **GIVEN** a page whose JSON-LD has a `Product` with an offer
- **WHEN** its kind is read
- **THEN** it is a shop

#### Scenario: A forum thread

- **GIVEN** a page whose JSON-LD is a `DiscussionForumPosting`
- **WHEN** its kind is read
- **THEN** it is a forum

#### Scenario: A video

- **GIVEN** a page whose `og:type` is `video.other`
- **WHEN** its kind is read
- **THEN** it is a video

#### Scenario: No signal

- **GIVEN** a page with no JSON-LD and no `og:type`
- **WHEN** its kind is read
- **THEN** it is unclassified, whatever its host

### Requirement: A kind of source is missing only when the session can tell

A kind of source — shop, review, forum, video — SHALL be reported as not read only when the session has at least 3 pages that are not search results and at least half of them are classified, and none of them is of that kind. Otherwise no kind SHALL be reported.

#### Scenario: Most pages classified

- **GIVEN** four pages, three classified as shop and review, and none as forum
- **WHEN** the gaps are read
- **THEN** forum and video are reported as not read

#### Scenario: Most pages unclassified

- **GIVEN** four pages of which one is classified
- **WHEN** the gaps are read
- **THEN** no kind of source is reported

#### Scenario: Too few pages

- **GIVEN** a session of two pages
- **WHEN** the gaps are read
- **THEN** no kind of source is reported
