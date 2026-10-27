# Proposal

## Why

The IKEA fixtures (`broaden-eval-fixtures`, Findings) showed what a page that is not a spec sheet does to the extractor. The readable text of a shop page is mostly its customer reviews, and the extractor makes facts of them: `price → great`, `looks good → good`, `easy to build → easy`; a reviewer's number sits beside the page's own (`cena → 129` next to `279 PLN`); a reviewer's word is taken for the value (`regulowane półki → Fajnie`). Meanwhile what the page states about the product, its dimensions and colour in the product name and its rating count in the structured data, never becomes a fact. Over the three IKEA pages 82.5% of the labelled facts are found against 97.6% on the five electronics pages.

## What Changes

- **Opinions are not facts.** `factExtraction@5` says that an opinion, a feeling, an evaluation or what a reviewer did or experienced is not a fact, and that a value is never an evaluation word ("great", "nice", "good").
- **Tidying what a rule can check.** A fact whose value is a bare evaluation word, or whose value is its attribute's word in other form, is dropped after the quote check, using what the extension already has; no list of words per language is kept for this beyond what the model itself returns (see Design).
- **The page's own data states more.** The rating count becomes a fact of its own beside the rating, and a fact quoted from the product name or the page's title counts as grounded, so a size or a colour the name states can be extracted.
- **Measured.** `npm run eval` over the same eight fixtures, with the numbers before and after.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fact-quality`: the prompt's rule about opinions, the tidying, and what grounds a fact.

## Impact

- `src/features/factExtraction` (prompt `@5`, `tidyFacts`, `buildProductFacts`, the quote check in `runFactExtractionJob`), its specs, and `evals/baseline.json`. Facts made by `@4` are extracted again.
- Behaviour only changes for pages with reviews or with facts in their title; electronics pages should stay where they are (97.6% found), and the eval says whether they do.
