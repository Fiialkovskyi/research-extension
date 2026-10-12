# Tasks

## 1. Storage and queue

- [x] 1.1 Add `StoredSpace`, `StoredChunk`, `StoredVector`, the stores `spaces`, `chunks` (with a `snapshotId` index) and `vectors` (keyed `[spaceId, chunkId, part]`), and the optional `StoredSession.activeEmbeddingSpaceId`. Raise `DATABASE_VERSION` to 11, and extend the migration and open specs.
- [x] 1.2 Add an optional `payload` to `NewJob` and `StoredJob`, kept by `enqueueJob`. Extend its spec.

## 2. Pure model

- [x] 2.1 Add `snapshotEmbeddings/model/chunkText` (`chunker@1`). Its spec covers:
  - a 1,000-word text gives about five chunks of whole sentences;
  - a one-sentence overlap;
  - a short text gives one chunk;
  - an overlong sentence is its own chunk;
  - offsets reproduce the text.
- [x] 2.2 Add `buildEmbeddingSpace`. Its spec covers:
  - deterministic ids;
  - the id changing with the commit and with the chunker or extractor version;
  - the stored fields.
- [x] 2.3 Add `splitChunkForModel`. Its spec covers:
  - a fitting chunk kept whole;
  - an overlong chunk split into parts that each fit and cover every word once;
  - the prefix counted.
- [x] 2.4 Add `compareVectors` and `EmbeddingSpaceMismatchError`. Its spec covers the cosine of known vectors and the mismatch throwing.

## 3. Jobs

- [x] 3.1 Add `enqueueSnapshotEmbeddings`. The fake-indexeddb spec covers:
  - one job per snapshot and the space stored;
  - nothing without a model or a session;
  - a done job not queued again.
- [x] 3.2 Add `runEmbeddingJob`, with a stubbed session. The specs cover:
  - chunks and vectors stored per part in the space;
  - batches checkpointed;
  - a resumed job starting after its checkpoint;
  - the session's space set once;
  - a missing snapshot failing.

## 4. Background

- [x] 4.1 In `app/backgroundApp`:
  - add a single-flight runner;
  - trigger it after a stored snapshot, at reconciliation (after requeueing) and after activation;
  - cache model sessions;
  - add an injectable `loadEmbeddingSession` dependency, which defaults to the worker path.

  The specs cover:
  - a stored snapshot ending with vectors;
  - no jobs without a model;
  - two triggers at once running one job at a time.

- [x] 4.2 Verify that `npm run typecheck` passes and that the background bundle builds.

## 5. Documentation

- [x] 5.1 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`:
  - LIN-001 and LIN-002, and the pipeline's chunk and embed steps, note what is built;
  - vectors left unencrypted is recorded as a risk.

  Verify that `openspec validate add-snapshot-embeddings --strict` passes.

- [x] 5.2 Run `npm run verify` and confirm that it passes.
