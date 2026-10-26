# Tasks

## 1. The extractor names the concept

- [x] 1.1 Add `factExtraction@3.md` and its schema beside `@2` (each fact gains a required `concept` string of at most 40 characters; the prompt asks for a short English noun phrase, the same whatever the page's language), set the version to 3, mirror the schema in valibot, and keep `constants.spec.ts` in step; verify the schema and prompt guards.
- [x] 1.2 Store the `concept` in the sealed fact (`sealFact`, `sealedFactSchema`, `readSealedFact`); a fact without one reads as its normalised attribute; page-data facts (`buildProductFacts`) write English concepts (`price`, `brand`, `availability`, `rating`); verify specs for both and an old sealed fact.
- [x] 1.3 Replace the unit list of `isImplausibleSubject` by `NORMALIZED_UNITS` from entity resolution's own table (exported for the purpose), keep the structural rules; verify the specs still pass, plus a subject with a unit the table does not know is kept.

## 2. Concepts become column keys

- [x] 2.1 Add `resolveConceptKeys(concepts, embed?)` as a shared module: normalised equal concepts merge, then, with `embed`, similar ones above `CONCEPT_SIMILARITY_THRESHOLD`, greedily through the commonest representative, never chained; no embedding or a failing one leaves exact merges only; verify specs for both paths, no chaining and a failing `embed`.
- [x] 2.2 Use it in `readComparisonTable` and `readSummariesView` (keys from concepts, column labels by the commonest attribute spelling); pass `embed` from `backgroundApp` with an in-memory cache by concept and embedding model; verify the reader specs and a composition-root spec that the cache calls `embed` once for a repeated read.
- [x] 2.3 Fix `CONCEPT_SIMILARITY_THRESHOLD` from a test set of pairs that must merge (`weight`/`mass`, `battery capacity`/`battery size`) and must not (`battery life`/`battery capacity`, `screen size`/`screen resolution`), run against the embedding model if one is installed, else against recorded vectors; document the set. No threshold separated them (measured with `nomic-embed-text`); the threshold, 0.90, is set above every pair that must stay apart, and the pairs are in the constant's comment and the design.

## 3. Importance and noise from the data

- [x] 3.1 Replace the rank by `KEY_SPEC_ORDER` with comparability (distinct entities, then pages, then key; for one entity, pages, then shorter value) in `buildSpecs`, `scoreSummaryFact` and `proposeColumns`; page-data facts still first; verify specs: several products share one concept, a single product, ties.
- [x] 3.2 Replace `GENERIC_ATTRIBUTES` and the variant list by the structural rules (prose over 8 words, the same value on every entity that states it, one row only) in `proposeColumns`, `buildCell` and `buildSpecs`; verify the scenarios of `comparable-attributes` and that the old behaviour for the phone fixtures is unchanged where it was structural.
- [x] 3.3 Make cards for the entities the requirement names (page-data fact, or the commonest type of the cluster's entities with at least 3 facts) instead of `entityType === "product"`; verify specs: a type in another language, a shop's product of another type, a company beside products, no card-worthy type.

## 4. Remove the lists

- [x] 4.1 Delete `shared/config/attributeSynonyms`, `shared/getAttributeKey`, `shared/isVariantAttributeKey`, `KEY_SPEC_ORDER`, `GENERIC_ATTRIBUTES`, their specs and exports; keep `CARD_HEADER_KEYS` for the page-data attributes the extension names itself; verify that nothing imports them (`tsc`) and that no spec fixture relies on a list.

## 5. Docs

- [x] 5.1 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md` (REQ-SYN-012…015 and the roadmap line: concept, merging, comparability, no lists) and run `openspec validate make-facts-domain-agnostic`.

## 6. After `write-useful-summaries` is archived

- [x] 6.1 With `openspec-update-change`, add MODIFIED deltas for the `product-cards` and `summary-quality` requirements that name a fixed order of key specs and the type `product`, so the main specs agree with this change; validate.
- [x] 6.2 Run `npm run verify` and report faithfully. Say that the quality of the model's concepts is not run in the suite, and list the manual check: "Extract facts now" on the "Iphone" session and on a session about something unlike it (a pen, a bath mat), in Ukrainian and in English, and read the table and the cards.
