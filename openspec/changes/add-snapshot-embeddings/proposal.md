# Proposal

## Why

Deep-read pages now have encrypted snapshots, and the extension can install, verify and activate an
embedding model (`spike-huggingface-inference`, archived). Nothing connects the two. Embeddings are
the step every later M2 and M4 feature stands on:

- semantic edges for clustering (REQ-CLU-002);
- retrieval for synthesis;
- entity resolution.

This change builds the model-independent half of that pipeline and runs it through the job queue's
first real job:

- chunking;
- embedding spaces;
- the vector store;
- an idempotent embedding job.

The spike's gate measured the in-extension provider at about 4 chunks/s, against a budget of 20
(NFR-004), and recommended that the native host move earlier. This change does not depend on which
provider embeds. It loads the active model through the existing provider path, and a native provider
will slot in behind the same call. The slowness is accepted here because the work runs in the
background, one batch at a time, and nothing waits on it.

## What Changes

- **`chunker@1`.** A sentence-aware chunker (`Intl.Segmenter`) targets about 220 words per chunk with
  a one-sentence overlap. Chunks are stored as character offsets into their snapshot, never as text,
  so no page text is stored outside the encrypted snapshot.
- **Embedding spaces** (REQ-LIN-001). A space is identified by the SHA-256 of the canonical JSON of:
  - the model reference (repository and commit);
  - dimensions, pooling, normalisation, similarity and prefixes;
  - `chunker@1`, and the snapshots' extractor version.

  Spaces are stored, and every vector records its space.

- **The vector store** is keyed by `[spaceId, chunkId, part]`, so reading one space reads one key
  range.
- **Fitting chunks to the model.** A chunk whose estimated token count exceeds the model's
  `maxInputTokens` is split into parts at word boundaries. Each part gets its own vector.
- **Embedding jobs.** Each snapshot of the active session gets an idempotent `embedSnapshot` job,
  identified by its content hash and the target space, when the snapshot is stored, when the
  background starts, and when an embedding model is activated. The background runs one job at a time
  (REQ-MOD-008), outside the capture queue. Each job checkpoints after every batch, and is retried
  with backoff on failure. With no active embedding model, nothing is queued and capture is
  unaffected.
- **The session's space** (REQ-LIN-002). A session gets its `activeEmbeddingSpaceId` with its first
  vectors. Comparing two vectors from different spaces throws `EmbeddingSpaceMismatchError`.

## Capabilities

### New Capabilities

- `snapshot-embeddings`: chunking deep-read text, embedding spaces, the vector store, the embedding
  job and its triggers, and the cross-space guard.

### Modified Capabilities

None.

## Impact

- **New code:** `features/snapshotEmbeddings/`:
  - `chunkText`, `buildEmbeddingSpace`, `splitChunkForModel`;
  - `enqueueSnapshotEmbeddings`, `runEmbeddingJob`;
  - `compareVectors` with `EmbeddingSpaceMismatchError`.
- **Changed code:**
  - `app/backgroundApp`: a single-flight job runner, triggers after a snapshot, at start-up and after
    activation, and a cached model session per model;
  - `pageSnapshots` exposes the snapshot's extractor version for the space.
- **Storage:** database version 11 adds `spaces`, `chunks` and `vectors`, and sessions gain an
  optional `activeEmbeddingSpaceId`.
- **Out of scope:**
  - re-embedding on model swap and space retention (REQ-LIN-003, REQ-LIN-004);
  - semantic clustering edges;
  - retrieval;
  - encryption of vectors.
- **Not covered by e2e:** an offline end-to-end embedding run, which needs the model fixture deferred
  from the spike as `add-offline-model-e2e`. Unit tests use a stubbed model session, and the opt-in
  network spec exercises a real model.
