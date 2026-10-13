# Tasks

## 1. Storage

- [x] 1.1 Add `facts` and `extractions` to `shared/storage`: the `StoredFact` and `StoredExtraction` types (design decision 5) and migration 14 with the `sessionId` and `nodeId` indexes. Verify with the migration spec: a version-13 profile upgrades, keeps its data, and both stores are empty and indexed.

## 2. Generation contract

- [x] 2.1 Add an optional `contextTokens` to `GenerateRequest`, and have `createOllamaGenerator` send it as `options.num_ctx`. Verify with its spec: present when set, absent otherwise.

## 3. Fact extraction feature (pure parts)

- [x] 3.1 Create `features/factExtraction` with:
  - `prompts/factExtraction@1.md`, imported with `?raw`;
  - `prompts/factExtraction@1.schema.json`;
  - the valibot answer schema in `schemas.ts`;
  - `FACT_EXTRACTION_PROMPT` and `EXTRACT_FACTS_JOB` in `constants.ts`;
  - the guard `constants.spec.ts` from design decision 2.

  Verify that the guard passes, and that it fails when a property is removed from one schema only.

- [x] 3.2 Add `buildFactExtractionMessages(chunkText)`: the system prompt plus the delimited user message, escaping `</page_text>`. Verify with specs for:
  - the layout;
  - a chunk that tries to close the block;
  - a chunk that contains instructions.
- [x] 3.3 Add `isQuoteGrounded(quote, chunk)`. Verify with specs for an exact match, a match after collapsing whitespace, case mismatch, a quote not on the page and an empty quote.
- [x] 3.4 Add `readFactAnswer(text)`: parse and validate the answer, returning the facts or an invalid result. Verify with specs for:
  - a valid answer;
  - non-JSON;
  - a missing quote;
  - more than 12 facts;
  - a truncated answer.

## 4. The job

- [x] 4.1 Add `deferJob` and an optional `isPermitted` filter to `jobQueue`. `claimNextJob` skips rejected jobs, and `runNextJob` handles a `"deferred"` runner result. Verify with specs:
  - a rejected job does not block a lower-priority one;
  - a deferred job is queued, due now, with its checkpoint and attempts unchanged.
- [x] 4.2 Add `enqueueFactExtractions(database)`, with the identity and priority from design decision 6. Verify with specs for:
  - one job per snapshot;
  - none without a generation model;
  - none without a session;
  - a new job for a new prompt or model version;
  - idempotence.
- [x] 4.3 Add `runFactExtractionJob`, with its dependencies injected: database, generator, data key, gate, run log and clock. It performs the steps of design decision 6, writing facts and the extraction record in one transaction per chunk. Verify with specs for:
  - grounded facts stored encrypted, with provenance;
  - dropped facts counted;
  - an invalid answer counted and skipped;
  - resuming from a checkpoint without duplicates, including a redo of a chunk whose checkpoint was lost;
  - deferral when the gate closes between chunks;
  - a missing snapshot failing.

## 5. Background

- [x] 5.1 Wire the feature into `app/backgroundApp`:
  - the `extractFacts` runner, run held, with the Ollama generator for the active generation model;
  - the `readIdleState` dependency and the gate from design decision 7, passed to `runNextJob`;
  - running jobs when the user becomes idle or locked;
  - enqueueing after a snapshot is stored, on generation-model activation and at reconcile;
  - the `facts.extractNow` message, which marks the session's queued jobs `requestedAt` and runs them.

  Supply `browser.idle.queryState` in the entrypoint. Verify with background specs against the fake Ollama:
  - a deep-read page extracted while idle;
  - nothing started while active, with embedding still running;
  - "extract now" running while active;
  - nothing queued without a generation model.

## 6. What was recorded

- [x] 6.1 Make `deleteNode` and `deleteSession` remove facts and extractions in their transaction. Verify with their specs, which gain facts.
- [x] 6.2 Make `readRecordedSession` report `factCount`, `droppedFactCount` and `canExtractFacts`, and have the background answer it. Verify with specs for a page with an extraction record, one without, and with and without a generation model.
- [x] 6.3 Recorded page:
  - show "N facts, M dropped" per page;
  - offer "Extract facts now" with `canExtractFacts`;
  - refresh while extraction runs.

  Verify with component specs. Extend `recordedData.e2e.ts`: with no generation model, a deep-read page shows no facts, and the button is not offered.

## 7. Documentation and verification

- [x] 7.1 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`:
  - tick the M4 item "Versioned prompts and schemas; fact extraction with grounding";
  - note the chunk-per-request decision and the idle gate in the SYN section;
  - record that the "include" mark is still open.

  Verify that `openspec validate add-fact-extraction --strict` passes.

- [x] 7.2 Run `npm run verify` and confirm that it passes.

## 8. Manual run (the maintainer's machine)

- [x] 8.1 With Ollama and `qwen3:4b` active:
  - deep-read a real product review page;
  - choose "Extract facts now";
  - record in design.md Findings the chunks, the facts kept and dropped, the invalid answers and the time per chunk;
  - check from the recorded page that the counts match.
