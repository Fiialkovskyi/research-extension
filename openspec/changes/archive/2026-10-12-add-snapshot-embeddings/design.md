# Design

## Context

- **Snapshots.** Encrypted gzip text per deep-read node (`StoredSnapshot`), read back by `pageSnapshots/readSnapshotText`. Each records `contentHash` and `extractorVersion`.
- **Models.**
  - `modelRegistry/getActiveModel(database, "embedding")` returns the active, conformant model.
  - Its `manifest.contract` has `dimensions`, `maxInputTokens`, `pooling`, `normalize`, `similarity` and `prefixes`, and `manifest.reference` has the repository and revision.
  - `inference/loadModelIntoWorker` returns a session whose `embed(texts, role)` gives `Float32Array[]`. The background owns the worker (`getWorkerForDevice`).
- **Jobs.** `jobQueue` provides:
  - `enqueueJob`, idempotent by `buildJobId(type, inputHashes, producerVersion)`, which skips a job that is queued, running or done;
  - `claimNextJob`, `checkpointJob`, `completeJob`, `failJob` (backoff, then `failed`) and `requeueRunningJobs`.

  It has no runner yet.

- **Background.** One serial capture queue. A snapshot is stored in `handleContentMessage` (`content.extracted`). `reconcileSession` runs at start-up. `model.activate` answers activation.
- **Gate finding.** The in-extension provider runs at about 4 chunks/s. A 40-page session is minutes of work, so the runner must not sit on the capture queue.

## Goals / Non-Goals

**Goals:**

- Chunking and space identity are pure and versioned.
- No page text outside the encrypted snapshot.
- Embedding never delays capture, and survives the event page unloading mid-job.

**Non-Goals:**

- **Model swap and re-embedding** (REQ-LIN-003, REQ-LIN-004). A new active model gets its own jobs and space, but the session keeps its first space until swap lands.
- **Semantic edges, retrieval, entity resolution.**
- **Encrypting vectors.** They are listed as a risk.
- **An offline e2e run.** It needs the deferred model fixture.

## Decisions

### `chunker@1` works on offsets

`model/chunkText(text) → { index, start, end }[]`:

- It segments with `Intl.Segmenter(undefined, { granularity: "sentence" })`, available in Firefox and Node, and counts words by whitespace.
- It accumulates sentences until the chunk reaches 220 words. The next chunk starts at the last sentence of the previous one. A single sentence over 220 words is a chunk of its own.
- The last chunk keeps what remains.
- Ranges are UTF-16 offsets into the snapshot's text, the same string `readSnapshotText` returns.

`CHUNKER_VERSION = "chunker@1"`.

### A space is a hash of what makes vectors comparable

`model/buildEmbeddingSpace({ model, extractorVersion }) → StoredSpace`:

- **The canonical JSON** has sorted keys and holds:
  - `model: { repository, revision }`;
  - `dims`, `pooling`, `normalize`, `similarity`, `prefixes`;
  - `chunkerVersion`, `extractorVersion`.
- **The id** is the hex SHA-256 of that JSON.
- **The record** stores the fields themselves, plus `createdAt`.

### Parts fit the model's input limit by estimate

The background has no tokenizer, so `model/splitChunkForModel(text, contract)`:

- estimates tokens as `ceil(words × 1.4) + 2`, where 2 covers the special tokens, plus the prefix's estimate;
- returns `[text]` when the estimate fits `maxInputTokens`;
- otherwise splits into the fewest consecutive word runs that each fit.

The estimate errs high for English subword tokenisers. A model truncating a slightly long part loses at most its tail, never a whole chunk.

### Storage version 11

- **`spaces`:** keyPath `id`.
- **`chunks`:**

  ```ts
  {
    id: (`${snapshotId}:${index}`,
      snapshotId,
      nodeId,
      sessionId,
      chunkerVersion,
      index,
      start,
      end);
  }
  ```

  It has an index on `snapshotId`, which the job reads by.

- **`vectors`:**

  ```ts
  { spaceId, chunkId, part, nodeId, sessionId, vector: Float32Array }
  ```

  Its keyPath is `["spaceId", "chunkId", "part"]`. A space's vectors are one key range, `IDBKeyRange.bound([space], [space, []])`, which is REQ-LIN-001's partition without a second store.

- **`StoredSession.activeEmbeddingSpaceId?`**, optional, so there is no rewrite.

### The job

- **`model/enqueueSnapshotEmbeddings(database, now)`.** For the active session and the active embedding model, it builds the space and stores it if new. Then, for every snapshot of the session, it enqueues:

  ```ts
  { type: "embedSnapshot", sessionId,
    inputHashes: [snapshot.id, snapshot.contentHash], producerVersion: space.id,
    priority: 0 }
  ```

  The snapshot's id is among the inputs, so two pages with identical text are still two jobs; their vectors are keyed by their own chunks. The snapshot id also goes in a `payload` the job reads. `jobQueue` jobs carry no payload, so it is added as an optional `payload?: unknown` on `NewJob` and `StoredJob`, validated by the job type. A done job is skipped by `enqueueJob`, which is what makes "asked twice" free. With no session or no model, it does nothing.

- **`model/runEmbeddingJob({ database, job, loadSession })`:**
  1. It reads the snapshot and its text.
  2. It chunks, and stores the chunks (`put`, which is idempotent).
  3. It fits each chunk into parts.
  4. In batches of 8 parts from the checkpoint's `nextPart`, it calls `session.embed(texts, "document")`, stores the vectors, and checkpoints `{ nextPart }`.
  5. It sets the session's `activeEmbeddingSpaceId` if unset, and completes the job.

  A missing snapshot or model fails the job with a reason. `loadSession(model)` is injected.

- **Runner in `app/backgroundApp`.**
  - A single-flight loop with an in-memory `isRunning` flag: claim, run, then complete or fail, until none is left.
  - It runs **outside** `serializeWork`, because its IndexedDB transactions are short and independent.
  - It starts after a stored snapshot, after `reconcileSession` (which first calls `requeueRunningJobs`), and after a successful `model.activate`.
  - Model sessions are cached by `model.ref` on the `wasm` device, and dropped when the worker is discarded.

### The cross-space guard

`model/compareVectors(first, second) → number` returns the cosine similarity of two `{ spaceId, vector }`, and throws `EmbeddingSpaceMismatchError` when the spaces differ. The error class lives in the feature's `errors.ts`.

Reporting the error to the local diagnostics log comes with its first caller (semantic edges), since nothing compares vectors yet.

## Risks / Trade-offs

- **[Vectors are stored unencrypted]** → Embedding-inversion attacks can partly reconstruct text from vectors. REQ-SEC-005 lists snapshots, facts and statements, not vectors. This is noted for the encryption follow-up, since vectors are 1.5 kB each and encrypting them is straightforward.
- **[The event page may unload during a long job]** → It checkpoints per batch. `requeueRunningJobs` at start-up hands an interrupted job back, and it resumes from `nextPart`.
- **[Slow on the in-extension provider]** → At about 4 chunks/s a typical page takes seconds. The runner is single-flight and off the capture queue, so the user only notices that vectors arrive late.
- **[`Intl.Segmenter` splits on abbreviations]** → "e.g." can end a sentence early. Chunks stay whole-sentence-ish, and this is accepted for `chunker@1`.

## Migration Plan

- **Version 11:** add `spaces`, `chunks` (with the `snapshotId` index) and `vectors`. There are no rewrites.
- `StoredJob.payload` is optional, so existing jobs are unaffected.
