## Context

`add-prompt-evals` gave the extraction and summary prompts their first numbers. Running it exposed defects that a fake model in the unit suite could not: answers cut off at 1,024 tokens (70% of them), values that were labels, doubled units, garbled subjects and mixed-language attributes. This change holds what was built on those numbers; the harness itself stays in `add-prompt-evals`.

## Goals / Non-Goals

**Goals:** fewer defects in what the model returns, found by measurement; a recommended model that measures better; no new network behaviour.

**Non-Goals:** a cross-product comparison built without a model; fixtures from other domains or languages; any change to storage.

## Decisions

1. **Raise the limits first.** 3,072 answer tokens and an 8,192 context. Measured: unreadable or cut-off answers 70% → 0%, labelled facts found 21% → 81%. Cheaper than any prompt rule and independent of the model.
2. **Rules in the prompt, repairs in code.** The model is told not to put a label in the value, not to double the unit and to copy the subject; a small model still does, so `tidyFacts` checks the same things after the quote check. The prompt lowers how often, the code removes what is left. `tidyFacts` and `repairSubject` live in `factExtraction/model` as pure functions with their own specs; `buildProductFacts` and `isImplausibleSubject` moved up out of `runFactExtractionJob/utils/` because `tidyFacts` and the evals now use them too.
3. **Repair a subject only when sure.** A subject is replaced by the page's product name only when it has a word absent from the name and at least 0.85 of its bigrams are contained in the name. A subject that names another product stays.
4. **A unit is stripped only when `unit` is set.** An empty `unit` means there is none; the value is left alone.
5. **Attributes stay in the page's language, concepts in English.** Mixed-language columns came from the model translating some attributes; concepts keep merging across languages.
6. **Page data below key specifications.** Only the price stays first; brand and availability scored above specifications and filled the summaries.
7. **`gemma4:12b` is recommended.** One run on five pages: 98% of labelled facts found (81%), 98.8% quotes on the page (96.2%), no facts dropped as junk (35.8%), 12.5% of summary statements naming two products (0%). Cost: about 7.7 GB of disk and memory instead of 2.5 GB. `qwen3:4b` stays as a profile for machines that cannot afford it.
8. **What did not work was reverted.** A stricter `clusterSummary@3` and grouping facts by attribute did not make a 4B model compare products (0%); neither is kept.

## Risks / Trade-offs

- One run of a model that varies, on five pages of one language and one domain; the numbers show a direction, not a guarantee.
- A larger recommended model raises the barrier to turning summaries on; the setup step announces the size before the click.
- `gemma4:12b` split one product page (LAUT) into two cards in the measured run; `qwen3:4b` did not.
- Re-extraction after the prompt version changes costs time on existing sessions.

## Open Questions

- `gemma4:26b` was not measured and is set aside for now: 16 GB is beyond a recommended default.
- Fixtures from a non-electronics page and another language.
