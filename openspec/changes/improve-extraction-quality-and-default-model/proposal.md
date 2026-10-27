# Proposal

## Why

The first real measurement of the extraction prompt (`add-prompt-evals`, five saved pages, `qwen3:4b`) showed that 70% of the model's answers were cut off by the token limit and that 21% of the labelled facts were found. Once the limits were raised, what the model returned was still full of defects: a label as the value ("Тип дисплея → Тип дисплея"), a unit twice ("177 г г"), a garbled subject ("Pixel 1: 10 Pro"), attributes in two languages, one quantity under two concepts, and a summary built from brand and availability instead of specifications. A second model, `gemma4:12b`, then found 98% of the labelled facts against 81%, and was the only one whose summary ever compared two products.

## What Changes

- **Room to answer.** The fact answer may be 3,072 tokens and the context 8,192 (was 1,024 and 4,096), so a page's facts are no longer cut off.
- **`factExtraction@4`.** The prompt copies the attribute in the page's language, never makes the value a label or the attribute's name, keeps a unit only in `unit`, drops a feature named with no value and a table row with a missing value, copies the subject exactly, and words a concept so that it says what the quantity belongs to ("screen resolution", not "resolution"). Facts made by `@3` count as made by another prompt and are extracted again.
- **Tidying after the quote check.** A fact whose value is another fact's attribute, or a multi-word value equal to its own attribute, is dropped. A one-word value equal to its own attribute takes the concept as the attribute. A subject with a foreign word that nearly contains the page's product name takes that name. A trailing unit word is stripped from a value whose `unit` is set.
- **Summary scoring.** Of the page's own data only the price still comes first; brand, availability and rating rank below the key specifications.
- **A recommended model that measures better.** `gemma4:12b` (about 7.7 GB) is the recommended text-generation model; `qwen3:4b` stays a profile, no longer recommended, and keeps working where Ollama already has it. The evals default to the new model.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fact-quality`: the prompt's rules and version, room to answer, and the tidying of facts after the quote check.
- `summary-quality`: the order in which a page's own data ranks among the summary's facts.
- `ai-setup`: which text-generation model is recommended.

## Impact

- `src/features/factExtraction` (constants, prompt `@4`, `tidyFacts`, `repairSubject`, `buildProductFacts` and `isImplausibleSubject` lifted out of `runFactExtractionJob/utils/`), `src/features/clusterSummaries` (`scoreSummaryFact`), `src/shared/config/ollama` (profiles), `README.md`, `evals/constants.ts`, and the unit specs that named the recommended model.
- Turning on AI downloads about 8.0 GB instead of 2.8 GB, and the model needs about that much memory. A user with `qwen3:4b` already pulled keeps it.
- Re-extraction of existing sessions follows from the prompt version; no storage migration.
- Measured on one run of five pages in Ukrainian (all electronics); other domains and languages are not yet in the fixtures.
