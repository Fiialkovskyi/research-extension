# Tasks

## 1. The pure helpers

- [x] 1.1 `evals/utils/matchFacts`: matches extracted facts against labelled ones by normalised concept and normalised number (`readNormalizedValue`), returns found and missing; verify specs for wording variants, units and a missing fact.
- [x] 1.2 `evals/utils/scoreMerges`: from the column keys the table gave each concept, the recall of `sameConcept` pairs and precision against `differentConcept` pairs; verify specs.
- [x] 1.3 `evals/utils/computeMetrics` and `formatReport`: the numbers of the design (junk rate, grounded rate, recall, merge scores, statements naming a product, cards and key specs, time, tokens), the difference against a baseline and the printed table; verify specs including no baseline.

## 2. The runner

- [x] 2.1 `evals/utils/readFixture`: reads a fixture directory and says why one is skipped (no labels, no HTML); `evals/utils/readPageForEvals`: HTML → jsdom → `extractReadableText` and `readPageMetadata`; verify specs with a small fixture under `evals/fixtures/`-like test data.
- [x] 2.2 `evals/utils/runExtraction`: chunker → `buildFactExtractionMessages` with the page context → `createOllamaGenerator` against the loopback (a plain `fetch` to the Ollama URL, nothing else) → `readFactAnswer` → grounding → `isImplausibleSubject` → `buildProductFacts`; keep the composition in one file that reads like `runFactExtractionJob`; verify specs with a fake generator.
- [x] 2.3 `evals/utils/runSession`: all fixtures' facts as one session: `resolveConceptKeys` (with the embedding model only when `EVAL_EMBEDDING_MODEL` is set), entity grouping by name, `buildCell`/`proposeColumns`, `readProductCards`, `selectSummaryFacts` and `buildSummaryMessages`, one summary request and the statements' product check; verify specs with a fake generator.
- [x] 2.4 `evals/prompts.eval.ts`: ties them together, checks Ollama is up and the model is there (ends with a clear message otherwise), honours `EVAL_MODEL`, `EVAL_RUNS`, writes `evals/reports/<time>.json`, prints the table, and takes `--update-baseline`; add `vitest.eval.config.ts`, `evals/tsconfig.json` in `npm run typecheck`, the `eval` script and `evals/reports/` in `.gitignore`.

## 3. The capture tool and the fixtures

- [x] 3.1 `evals/capture.ts` and `npm run eval:capture`: fetches a URL, writes `page.html`, `meta.json` and a `labels.json` template, refuses an existing id; verify a spec for the file layout and the refusal with a fake fetch.
- [x] 3.2 With the developer's pages (the six pages of the "Iphone" session on `jabko.ua` that were read deeply; its category page has no readable text without scripts and was left out, which leaves five), capture them, write their labels, and run the evals once to record `evals/baseline.json`. All five are electronics in Ukrainian: the set does not yet test other domains, which the design's open question still asks the developer to add.

## 4. Docs and verification

- [x] 4.1 Add a short paragraph on the evals to `AGENTS.md` (what they are, that they are outside `verify`, how to run, capture and update the baseline) and a REQ line and roadmap line to `RESEARCH_GRAPH_EXTENSION_SPEC.md`; run `openspec validate add-prompt-evals`.
- [x] 4.2 Run `npm run verify` and report faithfully; run `npm run eval` once against the local Ollama and report the numbers it printed, and say that they are one run of a small model.
