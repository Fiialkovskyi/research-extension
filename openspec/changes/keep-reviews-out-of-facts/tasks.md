# Tasks

## 1. Before

- [x] 1.1 Record the numbers of `npm run eval` on the current tree (the baseline) for comparison, and look at why the Polish BILLY page has no card of its own (merged or lost), writing the answer in the design.

## 2. The rule and the data

- [x] 2.1 Add `factExtraction@5` (`.md` and `.schema.json`) with the rule about opinions, and point the producer version and the specs at it.
- [x] 2.2 `buildProductFacts`: add the rating count as a fact; update its spec.
- [x] 2.3 The quote check: let a quote found in the product name or the title ground a fact, marked as taken from there; update `runFactExtractionJob`'s spec and add the cases of the design.

## 3. Measure and decide on code tidying

- [x] 3.1 Run `npm run eval` on the eight fixtures; compare with 1.1; note what review-shaped facts remain.
- [x] 3.2 Only for what remains and can be checked without a word list, add to `tidyFacts`; otherwise record in the design that none was needed. (Done: a measurement named as its own attribute is kept under the concept; evaluation words stay, see the design.)

## 4. Verification

- [x] 4.1 Run `openspec validate keep-reviews-out-of-facts`, update `evals/baseline.json` and REQ-SYN-012 in `RESEARCH_GRAPH_EXTENSION_SPEC.md`, and run `npm run verify`.
