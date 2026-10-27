# Proposal

## Why

Four changes in a row (`improve-fact-quality`, `write-useful-summaries`, `make-facts-domain-agnostic`, `tidy-research-views`) rest on how a 4B model behaves with `factExtraction@3` and `clusterSummary@2`, and none of it can be measured: the unit suite uses a fake model, and a real run means clicking "Extract facts now" on a live session and reading the result by eye. A prompt change cannot be told from a regression, a model swap cannot be compared, and the claim that the extension works for a pen or a bath mat as it does for a phone has no test.

## What Changes

- **Saved pages as fixtures.** A small set of real pages is kept as HTML under `evals/fixtures/<id>/page.html`, with hand-written labels (`labels.json`): the facts a reader would take from the page, as concept and value, and which concepts must stay apart or merge. The set covers more than one kind of thing (a phone, something that is not electronics) and more than one language.
- **A runner that is not part of `verify`.** `npm run eval` runs the extension's own pipeline over each fixture against a local Ollama model — the page's text and metadata, the chunker, the extraction prompt, grounding, the subject filter, concept merging, the comparison table, the product cards and the summary request — in a Node process, with no browser. It needs Ollama and says so when it is not there; it is never run by `npm run verify`.
- **Numbers, not verdicts.** The run prints and saves a report: the share of facts with a junk subject, the share grounded, the recall of the labelled facts, the concept-merge precision and recall, the share of summary statements that name a product, the cards and their key specs. A committed baseline is compared with, and shown as a difference; updating it is an explicit act.
- **A capture tool.** `npm run eval:capture -- <url> <id>` fetches a page from the developer's machine into a new fixture. It is a development tool outside `src/`; the extension gains no network behaviour.

## Capabilities

### New Capabilities

- `prompt-evals`: the fixtures, the runner, the report and the baseline.

### Modified Capabilities

None.

## Impact

- New `evals/` directory at the repository root (fixtures, runner, reports, baseline), `vitest.eval.config.ts`, an `evals/tsconfig.json` covered by `npm run typecheck`, scripts `eval` and `eval:capture`, and a note in `AGENTS.md`. Reports are ignored by git; fixtures and the baseline are committed.
- Nothing in `src/` changes except exports a runner needs from feature barrels, if any are missing; the runner imports the same modules the background does.
- Fixtures are copies of public pages: the user decides which pages to keep in the repository (see Open Questions).
