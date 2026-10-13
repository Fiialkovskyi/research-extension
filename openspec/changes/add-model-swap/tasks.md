# Tasks

## 1. Embedding swap

- [x] 1.1 Add `readSpaceCoverage` to `snapshotEmbeddings`, and `retiredAt?` and `removedAt?` to `StoredSpace`. Verify with specs for full, partial and empty coverage.
- [x] 1.2 Add `switchSessionSpace` to `researchSession` (design decision 1). Verify with specs: it switches, retires the space it left, does not retire a space another session uses, and clears a revived space's `retiredAt`.

## 2. Retention

- [x] 2.1 Create `features/embeddingSpaces` with `readSpaceUsage`, `removeSpace` and `purgeRetiredSpaces`. Verify with specs for:
  - counts and sizes;
  - a refusal to remove a space in use;
  - vectors deleted on removal;
  - a purge after 14 days and not before.

## 3. Generation swap

- [x] 3.1 Change the skip rules of `enqueueFactExtractions`, `enqueueClusterSummaries` and `enqueueOpenQuestions` (design decision 3). Verify with specs: a model change queues nothing for done work, while a fact change or a new page still does.
- [x] 3.2 Add `modelName` to the summary and question views, and show "Written by" and "Suggested by". Verify with view and component specs.

## 4. Background and options

- [x] 4.1 In `app/backgroundApp`:
  - run the switch after embedding passes and on activation;
  - run the purge on reconcile and on the wake alarm;
  - answer `spaces.list` and `spaces.remove`.

  Verify with background specs: an embedding swap switches once covered, and a generation swap leaves summaries in place.

- [x] 4.2 Add the `EmbeddingSpaces` card to the options page. Verify with component and options specs.

## 5. Documentation and verification

- [x] 5.1 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`:
  - tick "Embedding swap…" under M5;
  - tick "Research map page", built by `add-research-map`;
  - mark the native-host items as replaced by Ollama;
  - tick the M1 and M2 items the archived changes built.

  Verify that `openspec validate add-model-swap --strict` passes.

- [x] 5.2 Run `npm run verify` and confirm that it passes.
