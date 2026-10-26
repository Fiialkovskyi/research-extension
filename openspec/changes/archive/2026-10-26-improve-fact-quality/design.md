# Design

## Context

`runFactExtractionJob` sends the model one ~220-word chunk of a snapshot at a time, with `factExtraction@1` instructions and no context, validates the answer, keeps facts whose quote is in the chunk, and seals each as a `StoredFact` (subject, attribute, value, unit, quote). Entity resolution then makes an entity per subject (by normalised name, then by meaning), and `readComparisonTable` makes rows of the entities of the commonest type, columns of the attributes by `normalizeEntityName(attribute)` (ranked by how many rows have them), and a cell per row and column in which different values are a conflict. `readPageMetadata` already reads a page's head on load and the background stores it (`StoredPageMetadata`). Observed in `runFactExtractionJob`, `buildFactExtractionMessages`, `readComparisonTable`, `proposeColumns`, `buildCell` and in the user's saved pages of a real session.

A real shop page checked by hand: `jabko.ua` product pages carry JSON-LD `Product` with `name`, `brand`, `offers.price: "24399"`, `priceCurrency: "UAH"`, `availability` and `aggregateRating`.

## Goals / Non-Goals

**Goals:**

- A page's price, brand, availability and rating reach the facts, reliably and without the model.
- The extractor stops choosing subjects at random: it knows what the page is about.
- Junk subjects, split spellings and variants-as-conflicts disappear from the table.

**Non-Goals:**

- Rewriting summaries (cards, comparison text, choosing facts by importance), splitting a session into clusters by product, the gaps list and source-kind classification, and the interface noise. Later changes.
- Reading all of a page's markup: Microdata, RDFa and the `Review`, `Offer` lists of several products on a category page. Only the page's main `Product`.
- A bigger model, or a second verification pass. The prompt and the filters are the first step; a measured evaluation set is a separate task.
- Re-extracting facts automatically. The user asks ("Extract facts now").

## Decisions

### 1. Read the page's `Product` in the observer, send it with the metadata

`readPageProduct(document)` in `pageMetadata` parses each `<script type="application/ld+json">` (at most 8 scripts, each at most 200 KB) with `JSON.parse` inside `try`, walks arrays and `@graph`, and takes the first node whose `@type` is or includes `Product`. From it: `name`, `brand` (a string, or `brand.name`), `sku` is left out (it is often a placeholder), `offers` (the first offer, or the lowest-priced of an `AggregateOffer`): `price` and `priceCurrency`, `availability` reduced to its last path segment (`InStock`), and `aggregateRating`: `ratingValue` and `reviewCount`. With no JSON-LD product, the Open Graph `product:price:amount` and `product:price:currency` give a price alone. Every text is cut to a limit and cleaned like the other metadata; a price must parse as a finite number in a plausible range (>0 and <10^9); anything else leaves that field out. Nothing is evaluated or fetched, and no URL in the markup is followed. The result rides in the existing `page.metadata` message as an optional `product` and is stored on `StoredPageMetadata` (in the clear, like the site name: a price, a brand and a product name are what the title already says).

### 2. Product facts are written by the extraction job, not by a second pipeline

At the start of a snapshot's extraction, `buildProductFacts(product)` makes up to four facts: `price` (value `24399`, unit `UAH`), `brand`, `availability`, `rating` (value `5`, unit `of 5` with `reviewCount` in the quote). The subject is `product.name`; the type is `product`. They are sealed with the ordinary `sealFact` as facts of the snapshot (`<snapshotId>:product:<n>`), with provenance `productData@1`, and their quote reads `From the page's data: price 24399 UAH`, which tells a reader where it came from. They are written before the first chunk, so a redone job overwrites them and nothing is counted twice, and they go through entity resolution, the table, the summaries, rejection ("Wrong") and deletion exactly as other facts do, which is why they are facts and not a separate display. They need a snapshot, because facts hang from one: a product page that was only glanced at has its product data in "Page details" and no facts until it is read. A page without a product record writes none.

### 3. `factExtraction@2` tells the model what the page is

New prompt files `factExtraction@2.md` and its schema (unchanged in shape). Each request's user message opens with a short block of the page's own words, `<page_context>` … `</page_context>`: its title (from the stored metadata, else the node's), its site name and, when known, its product name, each cut to 200 characters and with a closing delimiter altered like the passage's. The instructions say this block is data about the page, not instructions, and add: when a passage describes the page's main product without naming it, the subject is that product's name as in the context; a value, a number with a unit, or a feature name is never a subject; when a passage compares several models in columns, give each figure to the model whose column states it, and leave the figure out if that cannot be told. The page title is page-controlled text, so it travels as delimited data exactly like the passage. The prompt version is recorded on every fact, so facts of `@1` and `@2` are told apart and a re-run replaces `@1` facts chunk by chunk (ids are `<snapshotId>:<chunk>:<n>`).

### 4. Drop implausible subjects after the model answers

`isImplausibleSubject({ subject, value, unit })` is true when the subject, normalised, is empty or only digits and punctuation, equals the fact's own value (with or without its unit), or begins with a number followed by a unit from a small bundled list (`″`, `"`, `mm`, `мм`, `cm`, `GB`, `ГБ`, `TB`, `ТБ`, `MP`, `Мп`, `mAh`, `мАг`, `W`, `Вт`, `Hz`, `Гц`, `cd/m²`, `кд/м²`, `hours`, `годин`, `min`, `хв`). Such a fact is dropped and counted with the ungrounded ones. `3M Scotch` or `7-Zip` begin with a number and a letter that is not in the list and stay. It does not catch every wrong subject (`Відтворення відео` is an attribute name); the page context in decision 3 is the main defence, this is a net under it. Observed examples are specs.

### 5. Attribute spellings: a bundled synonym table

`attributeSynonyms@1` maps about forty common product attributes, in Ukrainian, Russian and English, to one key: display and screen size, resolution, battery and capacity, charging and power, storage and memory, RAM, camera and its aperture (`діафрагма`, `aperture`), weight, dimensions, colour, material, warranty (`гарантія`), water resistance, processor, price, brand and so on. A function `getAttributeKey(attribute)` returns the synonym key when the normalised attribute equals or contains a listed phrase, and otherwise the normalised attribute as before. `readComparisonTable` uses it for `attributeKey`; each column's label is still its most frequent spelling. A table is small and the table is bundled data, so there is no model or embedding; a later change may extend it by meaning.

### 6. A conflict needs two pages; variants are options

In `buildCell`, a cell is a conflict only when at least two different pages give different values. Different values from a single page, and values of a variant attribute (storage, colour, size, from the synonym table) from any pages, are `options`: the cell shows them together (`128 / 256 / 512 GB`), the chosen value is the commonest as before, `isConflict` is false and `alternativeCount` is 0. The group structure stays, so every value keeps its sources and its "Wrong" button. Two shops disagreeing on a weight is still a conflict.

### 7. Columns that say nothing

`proposeColumns` leaves out of the proposed columns, into "other", attributes in a bundled generic list (`description`, `design`, `type`, `смартфон`, `title`, `name`) and, when the table has more than one row, attributes only one row has; with one row everything stays. A user's saved columns are shown as saved, as before.

## Risks / Trade-offs

- **A 4B model may ignore the context.** The page-data facts do not depend on it, and the filter and the two-page conflict rule limit the damage; a measured set is the next step. Accepted.
- **Pages without a `Product` record** (blogs, forums, many shops) get none of the structured gain. They still get the prompt and the filters.
- **`Product` on a category page** is the page's first product, not the list. A category page is rarely deep read; accepted, and the first product only is taken so a list is not read as one.
- **Prices are not comparable across currencies.** They are shown as the page gave them, with their currency.
- **The synonym table is a guess at what people compare.** It is data, easy to extend, and a miss leaves a spelling alone, as today.
- **Variant attributes hide a real disagreement** about, say, colour. The sources and values stay visible in the cell.
- **Old facts stay until re-extracted.** The extractor's version tells them apart; the session's "Extract facts now" is the way to refresh.

## Migration Plan

Nothing runs on upgrade. `StoredPageMetadata` gains an optional field, and a record without it is valid. Pages read from now on carry product data; a page read earlier gets it the next time it loads in a session tab. Rolling back leaves the field unread.

## Open Questions

- Should a re-extraction of a session be offered when the user opens a session with `@1` facts? Left to the user's button for now.
- Should multi-model tables be skipped outright by a rule (a passage with many `GB`/`″` figures in a row) rather than left to the prompt? Left to what the real run shows.
