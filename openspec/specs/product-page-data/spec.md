# product-page-data Specification

## Purpose

Defines what the extension reads from a page's product markup, how it keeps and shows it, and how it becomes facts of the page's product without the model.

## Requirements

### Requirement: A page's product data is read as the page loads

WHEN a session page loads, the content script SHALL read the page's main product from its `application/ld+json` markup — name, brand, price and currency, availability and rating with its count — and, when the markup has none, a price from the Open Graph `product:price` tags. Each text SHALL be cut to a fixed length, a price SHALL be a finite number above zero and below a billion, at most 8 scripts of at most 200 KB each SHALL be read, and nothing in the markup SHALL be run or fetched. A page with no product SHALL give none, and a field that does not fit SHALL be left out.

#### Scenario: A shop's product page

- **GIVEN** a page whose JSON-LD is a `Product` named `Google Pixel 10a 8/256GB` with brand `Google`, an offer of price `24399` `UAH` in stock, and rating `5` from `1` review
- **WHEN** the page loads in a session tab
- **THEN** the background keeps that name, brand, price, currency, availability and rating for the page

#### Scenario: A product among other markup

- **GIVEN** a page whose JSON-LD is a graph holding an organisation, a breadcrumb and a product
- **WHEN** it is read
- **THEN** the product's data is kept and the rest is ignored

#### Scenario: A price that is not a price

- **GIVEN** a product whose price is `"call us"`
- **WHEN** it is read
- **THEN** the name and brand are kept and no price is

#### Scenario: Broken or oversized markup

- **GIVEN** a page whose JSON-LD does not parse, or one script larger than 200 KB
- **WHEN** it is read
- **THEN** that script is skipped and the page loads and is recorded as any other

#### Scenario: A page with no product

- **WHEN** a page has no product markup and no product price tag
- **THEN** no product data is kept

### Requirement: The recorded page shows its product data

The "What was recorded" view SHALL show a page's product on its "Page details" line: its name, its price with currency, and whether it is in stock, when known.

#### Scenario: A page with a price

- **GIVEN** a page whose product data holds `Google Pixel 10a 8/256GB`, `24399 UAH` and `InStock`
- **WHEN** "What was recorded" is read
- **THEN** its "Page details" line names the product, the price `24399 UAH` and that it is in stock

### Requirement: Product data becomes facts without the model

WHEN a page's facts are extracted and the page has product data, the extension SHALL make facts of its product from that data — price with its currency, brand, availability and rating — with the product's name as their subject, and SHALL mark them as taken from the page's data and not as read by the model. They SHALL be stored sealed like other facts, SHALL be made again, not added, when the extraction is redone, and SHALL take part in entity resolution, the comparison table, the summaries and marking wrong like any fact. A page without product data SHALL make none.

#### Scenario: A price among the facts

- **GIVEN** a deep-read page whose product data holds `Google Pixel 10a 8/256GB` and `24399 UAH`
- **WHEN** its facts are extracted
- **THEN** a fact with subject `Google Pixel 10a 8/256GB`, attribute `price`, value `24399` and unit `UAH` is kept, and its quote says it is from the page's data

#### Scenario: Extracted again

- **GIVEN** the page's facts were extracted once
- **WHEN** the extraction is redone
- **THEN** the page has one price fact, not two

#### Scenario: No model

- **GIVEN** a page with product data and a model that answers nothing usable
- **WHEN** its facts are extracted
- **THEN** the product facts are still kept

#### Scenario: A page without product data

- **WHEN** the facts of a page with no product data are extracted
- **THEN** no fact is marked as from the page's data

#### Scenario: Marked wrong

- **GIVEN** a price fact from the page's data
- **WHEN** the user marks it wrong
- **THEN** it is left out of the table and the summaries like any rejected fact
