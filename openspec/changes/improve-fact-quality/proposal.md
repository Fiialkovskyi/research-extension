# Proposal

## Why

A real session — five pages of one shop about an iPhone 17, an Apple Watch, a strap and a Pixel — gave a Summaries page that is useless to read. Looking at what it showed (the saved pages `Summaries_ Iphone.html` and `What was recorded_ Iphone.html`, 2026-10-26) the problems start with the facts, before any summary or table is built:

- **Wrong subjects.** The extractor is shown ~220 words with no idea what page they come from. It takes the first noun as the subject, so the table has "products" such as `6,3″ Super Retina XDR` and `Відтворення відео` ("video playback"), and a column "смартфон".
- **A page that lists a whole line-up is read as one product.** The page of iPhone 17 also tabulates Air, Pro and Pro Max; their screen sizes (6,1 / 6,3 / 6,5 / 6,7 / 6,9″) and battery hours (20 to 105) all land on one subject and show as "conflict +8".
- **Nothing structured is used.** The shop's product pages carry a `Product` record (name, brand, price in UAH, availability, rating) in their markup. The price is the one thing a shopper wants and it is absent from every facts list, summary and table.
- **Spellings are not merged.** "діафрагма" and "aperture" are two columns; storage sizes 128 / 256 / 512 GB of one phone are "conflicts".

Fixing these makes the facts right, so the table and the summaries built from them stop being noise. Rewriting how summaries are written, clustering by product and the gaps list are separate, later changes.

## What Changes

- **Product data from the page.** The page observer reads the page's `Product` markup (JSON-LD, with the Open Graph `product:` price as a fallback) — name, brand, price and currency, availability, rating — with fixed limits, and the background keeps it with the page's metadata. "What was recorded" shows it on the page's "Page details" line.
- **Facts from it, without the model.** When a page's facts are extracted, its product data becomes facts of the page's product (price, brand, availability, rating) marked as taken from the page's data.
- **The extractor knows the page.** The fact-extraction prompt becomes `factExtraction@2` and each request says what page the passage is from (title, site, product name). The prompt tells the model to give facts about the page's main product to that product, never to use a value, number, unit or feature as a subject, and to give a line-up table's figures to the model whose column states them or to leave them out.
- **Implausible facts are dropped.** A fact whose subject is a bare value or a number with a unit is not kept (counted as dropped, as an ungrounded one is).
- **Spellings are merged.** A bundled table of common product attributes in Ukrainian, Russian and English gives "діафрагма" and "aperture" one column.
- **Variants are not conflicts.** A cell is a conflict only when different pages give different values. Several values from one page, and a variant attribute such as storage or colour, show as options ("128 / 256 / 512 GB"), not as a conflict.
- **Columns that say nothing are not proposed.** Generic attributes (description, design, type) and, for a table of several rows, attributes only one row has, are left in "other columns".

## Capabilities

### New Capabilities

- `product-page-data`: what is read from a page's `Product` markup, how it is stored and shown, and how it becomes facts.
- `fact-quality`: what the extractor is told about the page, which facts are dropped as implausible, how attribute spellings merge, and when values are options rather than a conflict.

### Modified Capabilities

None. The fact-extraction, entity-resolution and comparison-table changes are still open in `openspec/changes/`, so there are no main specs of theirs to modify; the new requirements stand beside them.

## Impact

- `pageMetadata` (reading the product data, the stored record, the "Page details" line), `pageSignals` (the `page.metadata` message carries it), `factExtraction` (prompt v2 and its builder, product facts, the implausible-subject filter), `comparisonTable` (attribute keys, `buildCell`, `proposeColumns`, the table and CSV), `recordedData`, and an e2e page with product markup.
- One storage addition: an optional `product` object on the stored page metadata (no migration; records without it are valid). Facts keep their shape; the new ones are told apart by their provenance (`productData@1`).
- Facts already extracted by `factExtraction@1` are not rewritten. "Extract facts now" on the session re-reads its pages with the new prompt and replaces them chunk by chunk.
- No new permission or network behaviour. The product markup is data parsed with `JSON.parse` under size limits; nothing in it is run or fetched.
- Not covered here: how summaries are written, splitting a session into product clusters, the gaps list and the source-kind table, the interface noise (the per-line "Wrong", long titles). Next changes.
