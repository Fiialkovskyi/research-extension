# Proposal

## Why

With the facts better (`improve-fact-quality`), the Summaries page is still the weakest part of what a shopper sees. In the real session of five shop pages (`Summaries_ Iphone.html`, 2026-10-26) it showed one cluster of 187 facts and twelve statements, mostly trivia ("The device supports video playback", "the aperture is f/1.8") that name no product, with no price, no product names and nothing to compare. Reading `clusterSummary@1`, `selectSummaryFacts` and `readSummariesView`:

- **Facts are picked for spread, not for importance.** `selectSummaryFacts` takes one fact per entity in turn up to 60 of 187. A price and a battery capacity weigh the same as "supports Dolby Vision", so the model sees the trivia the pages are full of.
- **The model is shown the raw subject, not the product.** A line is `F12 | Дисплей | тип | OLED | "…"`; the statement the model writes cannot say which product it is about, and says "the device".
- **The prompt asks for no structure.** It asks for up to eight "useful" claims, so what comes back is eight loose sentences, with no per-product view and no short comparison.
- **There is no place for what needs no model.** A shopper wants, per product, its name, price, a few key specs and where they were read. All of that is in the facts; a model adds nothing to it and, being a 4B model, can only get it wrong.

## What Changes

- **Product cards, without the model.** For each cluster, the Summaries page shows a card per product the cluster's facts describe (up to 6, the best supported first): its name, its price with currency, up to 5 key specs, and the site and day of its price (else its first source). Key specs are chosen by a bundled order of importance (screen, battery, storage, memory, camera, processor, charging, weight, water resistance) and shown with the value most facts state. A card is made only for an entity of type `product` that has at least 3 facts. Every shown value links to its quote, and has the same "Wrong" control as a citation.
- **Facts chosen by importance.** The summary's facts are picked by a score instead of by spread: product-data facts (price, brand), then attributes in the importance order, then facts stated by more than one page, then the rest; at most one fact per product and attribute, so 60 slots no longer fill with variants of one spec. The spread across products is kept.
- **The model is told which product.** Each fact line carries the product's resolved name (the root entity's), not the raw subject.
- **`clusterSummary@2`.** The prompt asks for claims that each name the product they are about, forbid "the device" and "it", and for the first statement to be a short comparison of the products by price and one or two shared specs when there are two or more. Statement count stays at most 8, citations are still required, and the grounding rules (REQ-SYN-003) are unchanged.
- **Statements that name nothing are dropped.** A statement that names none of the cluster's product names is left out of the view when at least one other statement names one.

## Capabilities

### New Capabilities

- `product-cards`: what a card shows, which entities get one, how its price and key specs are chosen and sourced.
- `summary-quality`: how the summary's facts are chosen, what the model is told, what a statement must do and which are dropped.

### Modified Capabilities

None. `add-cluster-summaries` is still an open change with no main spec, so these stand beside its requirements.

## Impact

- `clusterSummaries` (fact choice, message builder, prompt `@2`, view reader, statement filter, a cards section in the UI), a shared module for the attribute table that `comparisonTable` and `clusterSummaries` now both read (`getAttributeKey` and the synonyms table move out of `comparisonTable` to `shared/`, since a second feature now needs them), and the Summaries page's schemas.
- No storage change: cards are computed when summaries are read, from facts already stored. Existing summaries (`clusterSummary@1`) keep showing; their prompt version differs, so "Refresh" regenerates them, and a summary is stale as before when its fact set changes.
- No new permission or network behaviour.
- Not covered: splitting one session into clusters by product, accessories versus phones, the gaps list and source-kind table, the interface noise ("Wrong" on every line, long page titles). Next changes.
