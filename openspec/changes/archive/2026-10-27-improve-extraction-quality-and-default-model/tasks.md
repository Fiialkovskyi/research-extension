# Tasks

## 1. Room to answer and the prompt

- [x] 1.1 Raise `FACT_ANSWER_MAX_TOKENS` to 3,072 and `FACT_CONTEXT_TOKENS` to 8,192 in `factExtraction/constants.ts`, and use the constants in the job's spec instead of literals.
- [x] 1.2 Add `factExtraction@4` (`.md` and `.schema.json`) with the new rules, point the producer version and the specs at it, and have older facts re-extracted.

## 2. Tidying

- [x] 2.1 Lift `buildProductFacts` and `isImplausibleSubject` out of `runFactExtractionJob/utils/` into `factExtraction/model/`.
- [x] 2.2 Add `repairSubject`, and `tidyFacts` with `utils/stripRepeatedUnit` and `utils/isLabelValue`, each with a spec; call `tidyFacts` after the quote and subject checks in `runFactExtractionJob`, keying the entity types by the repaired name; export them from the barrel.

## 3. Summaries

- [x] 3.1 In `scoreSummaryFact`, score the price 100 and other page data 45, below key specifications; update its spec.

## 4. The recommended model

- [x] 4.1 In `shared/config/ollama`, add `gemma4:12b` (7.7 GB) as the recommended text-generation profile and keep `qwen3:4b` not recommended.
- [x] 4.2 Update the unit specs that named the recommended model and its size (`buildTurnOnPlan`, `listOllamaModelEntries`, `setupApp`, `backgroundApp`), including the fake Ollama's pull handling; update `README.md` and the evals' default model.

## 5. Docs and verification

- [x] 5.1 Update REQ-SYN-012 and add REQ-SYN-018 in `RESEARCH_GRAPH_EXTENSION_SPEC.md`.
- [x] 5.2 Run `openspec validate improve-extraction-quality-and-default-model`.
- [x] 5.3 Run `npm run verify` (green with these changes) and report faithfully, with the eval numbers of both models and that each is one run.
