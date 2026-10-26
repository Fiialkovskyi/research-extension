# Tasks

## 1. Product data from the page

- [x] 1.1 Add `readPageProduct(document)` to `pageMetadata` (with helpers each in a directory of its own): JSON-LD `Product` through arrays and `@graph`, name, brand, the first or lowest offer's price and currency, availability's last segment, rating and count; `product:price:*` fallback; limits (8 scripts, 200 KB, text lengths, a price that is a finite number above 0 and below a billion); verify specs for a shop's markup, a graph, an array, a price that is not a number, broken JSON, an oversized script, an `AggregateOffer`, the Open Graph fallback, no product and non-`Product` markup only.
- [x] 1.2 Carry the product in the `page.metadata` message (an optional `product` in the schema) and keep it on `StoredPageMetadata`; verify `recordPageMetadata` and `readStoredPageMetadata` specs, and that a record without it is valid.
- [x] 1.3 Show the product on the "Page details" line of "What was recorded" (name, price with currency, in stock) through the view schema and component; verify specs with and without product data.
- [x] 1.4 Add an e2e page with product markup and a spec that a session page's stored metadata holds its product; run it and report.

## 2. Product facts

- [x] 2.1 Add `buildProductFacts(product)` to `factExtraction`: price (value and unit), brand, availability, rating as facts of the product's name, type `product`, with the quote "From the page's data: …"; verify specs for each field, a product with only a name, and none for no product.
- [x] 2.2 In `runFactExtractionJob`, write the product facts first (ids `<snapshotId>:product:<n>`, provenance `productData@1`, sealed), overwriting on a redo; verify specs: kept without a usable model answer, once after two runs, none for a page without product data, and that entity resolution and the table take them.

## 3. The extractor knows the page

- [x] 3.1 Add `factExtraction@2.md` and its schema beside `@1`, set the prompt's version to 2, and give `buildFactExtractionMessages` a page context (title, site, product name; each cut to 200 characters, the closing delimiter altered); the job reads the context from the stored metadata and the node; verify specs for the request with and without each part, a title carrying the delimiter, and that facts record `factExtraction@2`.

## 4. Quality of what is kept and shown

- [x] 4.1 Add `isImplausibleSubject({ subject, value, unit })` and drop such facts in the job, counted as dropped; verify specs with the observed junk (`6,3″ Super Retina XDR`, `27`, `256GB` for value `256` unit `GB`) and with `3M Scotch`, `7-Zip`, an ordinary product and a Ukrainian name.
- [x] 4.2 Add the bundled `attributeSynonyms@1` and `getAttributeKey`, use it for `attributeKey` in `readComparisonTable`; verify specs: `діафрагма` and `aperture` one key, battery and display in three languages, an unlisted attribute keeps its own key.
- [x] 4.3 Change `buildCell`: a conflict needs at least two pages with different values; values from one page, and variant attributes (storage, colour, size), are options with no conflict flag; verify specs: one page with several values, variants across pages, two shops disagreeing (conflict), and that the value, order and sources are kept.
- [x] 4.4 Change `proposeColumns` to leave generic attributes and, for a table of more than one row, attributes of a single row among the other columns; verify specs including a saved set and a single row.
- [x] 4.5 Show options in the table cell without the conflict tag, and join them with `/` in the CSV; verify component and CSV specs.

## 5. Docs

- [x] 5.1 Document in `RESEARCH_GRAPH_EXTENSION_SPEC.md` (the `Product` capture next to REQ-CAP-011, the extractor prompt and the table rules next to REQ-SYN-*, a roadmap line) and run `openspec validate improve-fact-quality`.
- [x] 5.2 Run `npm run verify` and report the result faithfully. Say that the extractor's effect on a real model is not run in the suite (no generation model), and list the manual check: "Extract facts now" on the iPhone session, then compare the Summaries page with the saved one.
