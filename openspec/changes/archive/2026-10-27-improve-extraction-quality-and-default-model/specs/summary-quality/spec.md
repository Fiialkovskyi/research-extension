## MODIFIED Requirements

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
