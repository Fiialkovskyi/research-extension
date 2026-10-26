# Design

## Context

Today the column of a fact is `getAttributeKey(attribute)`: a lookup in a bundled table, else the normalised spelling. Cards and summary-fact choice use `KEY_SPEC_ORDER`; `proposeColumns` uses `GENERIC_ATTRIBUTES`; `buildCell` uses `isVariantAttributeKey`; the subject filter uses its own unit list; cards use `entityType === "product"`. All of these were chosen from one session of electronics.

The pieces that are already universal and stay: reading a page's `Product` markup, the page context for the extractor, the rule that a conflict needs two single-valued pages, entity resolution by name and by meaning, and the order of cards by fact count.

What the installation has: an optional embedding model (Ollama's `nomic-embed-text`, `all-minilm`, `mxbai-embed-large`, English-centred), used already for entity names through an injected `embed` function. A 4B text-generation model, which reads and translates short phrases well.

## Goals / Non-Goals

**Goals:**

- Nothing in the code names a product category or a language-specific attribute.
- A bath mat, a pen and a laptop get one column per concept, sensible key specs and a card, with the extension working as it does today for phones.
- Degrade, never break: with no embedding model, fewer merges, never wrong ones.

**Non-Goals:**

- A better extractor model. The result depends on the model's labels; this change makes the system able to use them.
- Fixing the type names a model invents in different languages (`phone` and `смартфон`): the card rule is built not to depend on them, the table's type choice is not touched.
- Clustering by product, gaps, interface noise.

## Decisions

### 1. The model names the concept, in English

The prompt `factExtraction@3` asks each fact for `concept`: "the attribute as a short English noun phrase, lower case, two or three words at most, the same for the same thing whatever language the page is in". The schema gains `concept` as a required string with a length limit, the sealed fact stores it, and `attribute` stays as written for display and for the rejection key (`factKey@1` is unchanged, so a rejected statement stays rejected). Old facts have no `concept` and read as their normalised attribute. The model, not a table, does the translation; English is chosen because labels are then comparable across pages in any language and any English embedding model can compare them.

### 2. Concepts merge into column keys by text, then by meaning

`resolveConceptKeys(concepts, embed?)` takes every distinct concept in a table's facts and returns a map from concept to column key:

1. Normalise (`normalizeEntityName`) and merge equal ones.
2. When `embed` is given, embed the distinct concepts (a few dozen short labels), and merge two concepts whose cosine similarity is at least `CONCEPT_SIMILARITY_THRESHOLD` (0.90, above the entity threshold because attributes are shorter and a false merge hides a difference), greedily and only into a representative that stays the most frequent concept, so a chain cannot drift.
3. The key of a group is its most frequent concept (then alphabetical).

Without `embed`, or if it fails, only step 1 applies. The function is pure over its inputs, takes the embedding as a dependency like entity resolution does, and the vectors are cached in memory by concept and embedding model in the background so a table read repeats no work. Facts with no concept use their normalised attribute as a concept.

The threshold was measured with `nomic-embed-text` on 19 pairs of English labels. No threshold separates them: `screen size`/`screen resolution` (0.89) and `processor`/`processor speed` (0.87) score above `weight`/`mass` (0.75), which should merge. So 0.90 is set above every pair that must stay apart: it merges `colour`/`color` (0.97), `price`/`cost` (0.91) and `battery capacity`/`battery size` (0.90), and leaves `weight`/`mass` as two columns. A column that could have merged stays two, never the reverse.

### 3. Importance is comparability

For a cluster's facts, a concept key's **comparability** is the number of distinct root entities that state it; its tie-breakers are the number of distinct pages, then the shorter commonest value (a spec is short), then the key. Key specs of a card, the order of proposed columns and the facts chosen for a summary all use it, replacing `KEY_SPEC_ORDER` and the old rank by rows only. With one entity in a cluster everything is stated by one, so the order falls to pages, then the shorter value. Facts from the page's product data still come first, as they are by construction what a shop page says about its product.

### 4. What is not a spec

A concept is left out of key specs and proposed columns (and stays among the other columns) when:

- its values are prose: more than 8 words, in the commonest value; or
- in a table of two or more entities that all state it, every one states the same value (it does not tell them apart, like `type: phone` on every row); or
- only one entity states it and the table has more than one row (already so). This last rule applies to the proposed columns and to the facts a summary picks as key specs; a card still shows such a spec after the shared ones, since a product's own facts are what its card is for.

Prose and equal-for-all are measured on the facts, so they need no list of words and work in any language.

### 5. Variants by structure

`isVariantAttributeKey` and the `variant` flags go. A cell's options are still found as `improve-fact-quality` defines them: several values of a concept for one entity from a single page are options. Values of one concept for one entity that different pages give differently are a conflict, shown with its sources, as for any other attribute. This is honest where it matters (two pages disagree) and a little noisier where a shop has one page per variant and the pages merge into one entity; a variant with its own name (`256GB` in the title) usually is a separate entity, so it is a row, not a conflict.

### 6. Implausible subjects, by structure

`isImplausibleSubject` keeps its structural rules (empty, no letter, equals its own value) and replaces its unit list by `readNormalizedValue`'s own: a subject is implausible when it begins with a number and the text after it, up to the next space, is a unit that `NORMALIZED_UNITS` knows. Units it does not know pass, so the filter is smaller than before; the prompt (decision 1's sibling instruction, "never a number with a unit") carries the rest.

### 7. Cards for what the research is about

`readProductCards` stops testing `entityType === "product"`. Candidates are the root entities with at least 3 facts that either have a fact from the page's product data or have the type that is commonest, by entity count, among the candidates with at least 3 facts in the cluster, whatever the type is called. Without a card-worthy type or product data, a cluster shows no cards, as today. The rest of the card logic (price from page data, key specs by decision 3, sources) stays.

### 7a. What is removed

`ATTRIBUTE_SYNONYMS`, `GENERIC_ATTRIBUTES`, `AttributeSynonym`, `shared/getAttributeKey`, `shared/isVariantAttributeKey`, `KEY_SPEC_ORDER`, `CARD_HEADER_KEYS` keep only the page-data attributes the product facts write (`price`, `brand`, `availability`, `rating`), which the extension itself names — these are in English by construction.

## Risks / Trade-offs

- **The model may label a concept inconsistently** (`battery`, `battery capacity`). Embeddings merge most of these; without an embedding model fewer merge and a column splits in two. This is the old behaviour at worst, not a wrong merge.
- **A 4B model's English labels may be poor for rare attributes or scripts.** The original wording stays visible, and a label that is wrong only affects merging.
- **The threshold is a trade-off** and no value is right for all pairs (see decision 2): it is set to merge only near synonyms, so `weight`/`mass` stay two columns until a better embedding model is installed.
- **Comparability needs several products to mean anything.** For a single product the rank falls back to pages and short values, which is a weaker order than the old list for phones.
- **No seed is shipped.** A cold start on a single page is worse than with the list. Accepted: it is what makes it work for everything else.
- **Cost:** one more field per fact (a few tokens), and a few dozen short embeddings per table read, cached.

## Migration Plan

Nothing runs on upgrade. Facts of `@2` keep working with their normalised attribute as concept. "Extract facts now" re-reads a session with `@3`. Rolling back leaves `concept` unread.

## Open Questions

- Should the extractor's `concept` also be asked for entity types, so that `phone` and `смартфон` agree? Left out: the card rule does not need it, and a table type choice is its own change.
- Is 0.90 right? Measured with one embedding model only; `all-minilm` and `mxbai-embed-large` are not measured, and the threshold is a constant to revisit if one of them becomes the default.
