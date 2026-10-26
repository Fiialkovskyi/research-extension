# Tasks

## 1. Share the attribute table

- [x] 1.1 Move `getAttributeKey`, `isVariantAttributeKey` and `ATTRIBUTE_SYNONYMS` (with `AttributeSynonym` and `GENERIC_ATTRIBUTES`) from `comparisonTable` to `shared/getAttributeKey` (one function per directory, the table in its `constants.ts`, imported as `@/shared/getAttributeKey`), and update `comparisonTable`'s imports; behaviour and specs unchanged. Verify the moved specs and `comparisonTable`'s still pass.

## 2. Names and importance in the facts

- [x] 2.1 Add `entityName` to `SummaryFact` and set it in `readSummaryFacts` from the root entity's decrypted name, else the subject; verify specs with a merged entity, a fact without an entity and an entity that fails to decrypt.
- [x] 2.2 Add `KEY_SPEC_ORDER` to `clusterSummaries/constants.ts` and change `selectSummaryFacts` to score by importance (product data, key-spec order, stated by more than one page), one fact per product and attribute before a second, the spread as the tie-break; verify specs for each rule above, the 187-fact case, variants not filling the list, and every product represented.

## 3. The prompt

- [x] 3.1 Add `clusterSummary@2.md` and its schema beside `@1`, set the version to 2, and give `buildSummaryMessages` the product name column; verify specs for the line format, delimiters and escaping, and that `constants.spec.ts` still keeps the two schemas in step.
- [x] 3.2 In `readSummariesView`, leave out statements that name none of the cluster's product names when another does (normalised, read-time only); verify specs for all three scenarios and that the stored statements are untouched.

## 4. Cards

- [x] 4.1 Add `readProductCards(facts, details)` to `clusterSummaries` (its helpers each in a directory of their own): entities of type `product` with at least 3 facts, ordered and limited to 6 with the count left out, the price (page data first, else commonest), up to 5 key specs in order with the commonest value and variants together, sources with site and day; verify specs for every scenario of `product-cards`.
- [x] 4.2 Add the cards to the cluster view's schema, `readSummariesView` (rejected facts removed) and `ClusterSummaries`, each value opening its quote with a "Wrong" control, and "+N more products"; verify the UI and reader specs, including a rejected fact and no price.
- [x] 4.3 Extend the Summaries page's spec harness (`summariesApp`) with a cluster that has a product card, and run it. The e2e suite has no generation model and no way to seed facts, so the card is checked there only as far as the page loading unchanged.

## 5. Docs and verify

- [x] 5.1 Document in `RESEARCH_GRAPH_EXTENSION_SPEC.md` (next to REQ-SYN-003/004 and in the roadmap) and run `openspec validate write-useful-summaries`.
- [ ] 5.2 Run `npm run verify` and report faithfully; say that the prompt's effect on a real model is not run in the suite, and list the manual check: refresh the summaries of the "Iphone" session after "Extract facts now", and compare with the saved page.
