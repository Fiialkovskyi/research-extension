# Proposal

## Why

`improve-fact-quality` and `write-useful-summaries` were tuned on one session — a shop's phones and watches — and carry that in bundled lists: `ATTRIBUTE_SYNONYMS` (about 30 electronics specs in Ukrainian, Russian and English), `KEY_SPEC_ORDER` (screen, battery, storage…), `GENERIC_ATTRIBUTES`, a list of variant attributes (storage, colour, size), a list of units for rejecting subjects, and a literal entity type `product` for cards. The extension is for any research, in any language: a pen, a laptop, a bath mat, a university, a recipe. For those the lists do nothing — a bath mat has no battery and no aperture — and the extension would fall back to its old behaviour: one column per spelling, no key specs, cards chosen by a word the model may not have used.

A universal solution has to get what the lists gave from the pages themselves.

## What Changes

Replace each list by a signal the data gives, in any language:

- **A fact names its concept.** The extractor (`factExtraction@3`) adds to each fact `concept`: the attribute as a short English noun phrase (`battery capacity`, `bristle length`, `pile height`), whatever language the page is in. The page's own wording stays in `attribute` for display. A 4B model is much better at translating a three-word label than at keeping a table of every attribute of every product.
- **Concepts that mean the same share a column.** Concepts are merged by exact normalised text, and, when an embedding model is active, by similarity of their embeddings (labels are English, so an English embedding model is enough). Without an embedding model, only the exact match merges. No table of synonyms.
- **Importance comes from the data.** A column or key spec is ranked by how comparable it is — how many different products state it, then how many pages — not by a fixed order. Prose (a value of more than 8 words) and a concept every product states with the same value are not specs. They stay among the other columns.
- **A variant is found by structure.** Several values of one concept for one product from one page are options. The list of variant attributes goes.
- **A junk subject is found by structure.** A subject that is empty, has no letter, is the fact's own value or begins with a number and a unit the value normaliser already knows is dropped. The extension's own list of units goes; the prompt is the main defence.
- **Cards for what the research is about.** A card is made for a root entity with at least 3 facts that has a fact from the page's product data, or whose type is the commonest among the cluster's entities with at least 3 facts, whatever that type is called. The literal type `product` goes.

The bundled lists are deleted; there is no hidden seed.

## Capabilities

### New Capabilities

- `comparable-attributes`: the concept of a fact, how concepts merge into columns, and how columns and key specs are ranked and filtered by the data.

### Modified Capabilities

- `fact-quality`: the extractor's prompt and fact shape (concept, `@3`); implausible subjects found by structure; "spellings share a column" by concept; "a conflict needs two pages" without a list of variants; "columns that say nothing" by the data.

## Impact

- `factExtraction` (prompt and schema `@3`, `concept` on the sealed fact, the plausibility filter), a new shared module that resolves concepts to column keys (merging by exact text and by embedding, with the embedding supplied by the caller), `comparisonTable` (keys from concepts, `buildCell`, `proposeColumns`), `clusterSummaries` (key specs, fact importance, cards), `backgroundApp` (passes the embedding function to the table and summary readers), and the removal of `shared/config/attributeSynonyms`, `shared/getAttributeKey`, `shared/isVariantAttributeKey`, `KEY_SPEC_ORDER`.
- Storage: the sealed fact text gains an optional `concept`; facts made before it keep working, falling back to their normalised attribute as before. No migration.
- Facts extracted by `factExtraction@2` are not rewritten; "Extract facts now" re-reads a session with `@3`.
- No new permission or network behaviour. An embedding is asked of the local embedding model already used for names, and only for short concept labels, never page text.
- Sequencing: this change builds on `write-useful-summaries`, which must be archived first. The product-cards and summary-quality requirements it adds describe a fixed order of key specs and the type `product`; when this change is applied, those requirements are modified with `openspec-update-change` in the same step (task 6.1, done).
