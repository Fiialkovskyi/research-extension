# Tasks

## 1. Storage and reuse

- [x] 1.1 Add `StoredQuestions` and the `questions` store (migration 19), and add it to `deleteSession`. Verify with the migration and `deleteSession` specs.
- [x] 1.2 Let `buildSummaryMessages` take the system instructions, and export it and `selectSummaryFacts` from the `clusterSummaries` barrel. Verify that its spec still passes, and add a case for custom instructions.

## 2. Open questions feature

- [x] 2.1 Create `features/openQuestions` with the `openQuestions@1` prompt files, the valibot mirror and the guard. Verify that the guard passes.
- [x] 2.2 Add `readQuestionsAnswer`. Verify with specs for valid answers, trimming, empty entries, more than 5 questions, and non-JSON.
- [x] 2.3 Add `readSessionFactIds`, `enqueueOpenQuestions`, `requestOpenQuestions`, `runOpenQuestionsJob` and `readOpenQuestions` (design decisions 1–5). Verify with specs for:
  - the 60 s debounce;
  - none without a model;
  - skipping current questions;
  - supersession;
  - encrypted storage;
  - staleness;
  - pending;
  - rejected facts left out.

## 3. Background and page

- [x] 3.1 Wire the runner (held, in the generation gate), the enqueues, and `questions.read` and `questions.refresh` into `app/backgroundApp`. Verify with background specs against the fake Ollama, including its question answer.
- [x] 3.2 Add the `SuggestedQuestions` component and render it on the Synthesis page, with polling. Verify with component and app specs. Extend `summaries.e2e.ts`: without a generation model, the section says one is needed.

## 4. Documentation and verification

- [x] 4.1 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`: tick "Gaps and open questions", and record the questions' pipeline. Verify that `openspec validate add-open-questions --strict` passes.
- [x] 4.2 Run `npm run verify` and confirm that it passes.

## Deferred

- A manual run with `qwen3:4b` on a real session, recording the questions and whether they are useful. It is deferred like the other manual runs, under the maintainer's standing instruction of 2026-10-13.
