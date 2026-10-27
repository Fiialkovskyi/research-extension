## ADDED Requirements

### Requirement: An opinion is not a fact

The extraction instructions SHALL say that an opinion, a feeling, an evaluation, or something a reviewer did or experienced is not a fact, and that a value is never an evaluation word. After the quote check, a fact whose value is only a word of evaluation SHALL be dropped.

#### Scenario: A review sentence

- **GIVEN** a passage "Great price. Easy to build, looks good."
- **WHEN** facts are extracted
- **THEN** none of `price → great`, `assembly → easy` or `appearance → good` is kept

#### Scenario: A stated figure in a review

- **GIVEN** a passage "Kallax is 77x147 cm and fits my room"
- **WHEN** facts are extracted
- **THEN** the dimensions are a fact and "fits my room" is not

### Requirement: What the page's own data states becomes facts

The facts made from a page's product data SHALL include the review count, the rating's count, beside the rating, under a concept that does not share a column with the rating. A fact whose quote is found in the page's product name or title SHALL count as grounded.

#### Scenario: A review count

- **GIVEN** a page whose data gives a rating of 4.5 from 2112 reviews
- **WHEN** its product facts are made
- **THEN** there is a fact of the rating and a fact `review count` 2112

#### Scenario: A size in the product name

- **GIVEN** a product named `BILLY Bookcase - white 80x28x202 cm`
- **WHEN** the model states the dimensions `80x28x202` and quotes the name
- **THEN** the fact is kept as grounded

## MODIFIED Requirements

### Requirement: The extractor is told what the page is

Each request to extract facts SHALL say, as data and not as instruction, which page the passage comes from: its title, its site and, when known, its product, each cut to a fixed length. The instructions SHALL say that facts about the page's main product, when the passage does not name it, belong to that product; that a value, a number with a unit or a feature name is never a subject, and that the subject is copied exactly as the page writes it; that figures of a table comparing several models belong to the model whose column states them or are left out, and that a table row whose value is missing states no fact; that the attribute is copied in the page's language and never translated; that the value is never a label or the attribute's name, that a unit goes only in `unit`, and that a feature named with no value is not a fact; that an opinion, a feeling, an evaluation or what a reviewer did is not a fact; and that each fact gives its attribute's concept as a short English noun phrase that says what the quantity belongs to, whatever language the page is in. The context SHALL be delimited so that the page cannot end it, and the prompt's version SHALL be recorded on every fact.

#### Scenario: A passage with the page's context

- **GIVEN** a page titled `Apple iPhone 17 — купити` on the site `Ябко`
- **WHEN** a passage of it is sent to the model
- **THEN** the request names that title and that site as the page's context, apart from the passage

#### Scenario: A title that tries to give orders

- **GIVEN** a page whose title contains the closing delimiter and an instruction
- **WHEN** its passage is sent
- **THEN** the title cannot end the context block, and the instructions still tell the model it is data

#### Scenario: The prompt's version

- **WHEN** facts are kept from a request made with this prompt
- **THEN** each fact records `factExtraction@5`

#### Scenario: Facts of the earlier prompt

- **GIVEN** a page whose facts record `factExtraction@4`
- **WHEN** facts are next extracted
- **THEN** the page is extracted again, since its facts were made by another prompt

### Requirement: Facts are tidied after the quote check

After a fact's quote is found on the page and its subject is accepted, the extension SHALL tidy it: it SHALL drop a fact whose value is another kept fact's attribute, and a fact whose value of more than one word and without a digit equals its own attribute; it SHALL give a fact whose value, alone or with its unit, equals its own attribute, being one word or having a digit, the concept as the attribute; it SHALL give a subject that has a word absent from the page's product name, but nearly all of whose text is contained in that name, the product name; and it SHALL strip a trailing unit word from a value whose `unit` is set. A fact with an empty `unit` SHALL keep its value as it is.

#### Scenario: A label as the value

- **GIVEN** facts `Тип дисплея → Тип дисплея` and `Тип дисплея → Super Retina XDR`
- **WHEN** they are tidied
- **THEN** the first is dropped and the second kept

#### Scenario: A value that is the name of a row

- **GIVEN** a fact whose attribute is `Колір` and whose value is `Колір пристрою`, which is also another fact's attribute
- **WHEN** it is tidied
- **THEN** it is dropped

#### Scenario: A one-word value equal to its attribute

- **GIVEN** a fact whose attribute and value are both `S10`, with the concept `processor model`
- **WHEN** it is tidied
- **THEN** it is kept with the attribute `processor model`

#### Scenario: A measurement named as its own attribute

- **GIVEN** a fact whose attribute is `80x28x202 cm`, whose value is `80x28x202 cm`, and whose concept is `dimensions`
- **WHEN** it is tidied
- **THEN** it is kept with the attribute `dimensions`

#### Scenario: A garbled subject

- **GIVEN** a page whose product is `Google Pixel 10 Pro` and a fact whose subject is `Pixel 1: 10 Pro`
- **WHEN** it is tidied
- **THEN** its subject is `Google Pixel 10 Pro`

#### Scenario: A subject of another product

- **GIVEN** a page whose product is `Google Pixel 10 Pro` and a fact whose subject is `Pixel Watch`
- **WHEN** it is tidied
- **THEN** its subject is unchanged

#### Scenario: A doubled unit

- **GIVEN** a fact whose value is `177 г` and whose unit is `г`
- **WHEN** it is tidied
- **THEN** its value is `177`
