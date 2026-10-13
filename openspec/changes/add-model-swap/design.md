# Design

## Context

- **Spaces.** `buildEmbeddingSpace` derives a space from the active embedding model.
  `enqueueSnapshotEmbeddings` stores the space and queues one job per snapshot and space, so after
  a swap the active session's snapshots are already re-embedded into the new space.
  `runEmbeddingJob` ends with `claimSessionEmbeddingSpace`, which claims only a first space.
- **Chunks.** Chunks are model-independent (`chunker@1`), with ids `<snapshotId>:<index>`. Vectors
  are keyed `[spaceId, chunkId, part]`.
- **Readers of the session space.** `reclusterActiveSession` reads `activeEmbeddingSpaceId`;
  reattach and entity resolution embed with the active model directly.
- **Generation jobs.** Extraction, summary and question jobs carry the model in their producer
  version. Their enqueues skip only work that is done for the current model.

## Decisions

### 1. Coverage and the switch

- **Coverage.** `readSpaceCoverage(database, sessionId, spaceId)` reads the session's chunks
  (`CHUNK_STORE`, index `sessionId`) and checks each for a vector in the space, reading part 0's
  key. It returns `{ covered, total }`.
- **The switch.** `switchSessionSpace(database, sessionId, spaceId, now)`, in one transaction
  over sessions and spaces:
  - it sets the session's `activeEmbeddingSpaceId`, and returns the space it left;
  - if no other session, saved ones included, references that space, it sets `retiredAt = now`
    on it;
  - it clears `retiredAt` on the new space, should it have been retired before.
- **When.** `maybeSwitchSpace` runs after a pass of the job runner that embedded anything, and
  after an embedding model is activated. It switches only when the active model's space differs
  from the session's, and covers `total > 0 && covered === total`.
- **Sessions without a space.** A session with no space still claims through the existing path.

### 2. Retention

- **Fields.** `StoredSpace` gains `retiredAt?` and `removedAt?`. They are optional, so no
  migration is needed.
- **`removeSpace(database, spaceId, now)`** deletes the space's vectors, a key range on
  `[spaceId]`, and sets `removedAt`. It refuses a space that any session uses.
- **`purgeRetiredSpaces(database, now)`** removes every space with `retiredAt` more than 14 days
  ago and no `removedAt`. It runs on startup reconcile and on the `jobs.wake` alarm. The alarm
  exists only while jobs are queued, so a profile with no jobs purges on its next start.
- **`readSpaceUsage(database)`** lists the spaces with:
  - the model repository and revision;
  - the vector count (`countFromIndex` over a key range) and approximate bytes, computed as count
    × dims × 4;
  - `inUse`, when a session references the space;
  - `retiredAt` and `removedAt`.

### 3. Generation swap

- **Extraction.** `enqueueFactExtractions` skips a snapshot that already has an extraction record
  (`EXTRACTION_STORE`, keyed by snapshot), whatever its model. The job's identity keeps the
  model, so asking again under another model is still possible later.
- **Summaries.** `enqueueClusterSummaries` skips a cluster whose stored summary has the current
  fact-set hash, whatever its model. A summary whose model was removed is stale by REQ-LIN-006,
  and its "Refresh" regenerates it.
- **Questions.** `enqueueOpenQuestions` follows the same rule.
- **The runners.** They already skip a job whose producer is not the active model. A refresh
  request builds its job with the active model, so it runs.
- **Labels.** The summary and question views add `modelName`: the stored model's repository, or
  the ref when the model is gone. The UI shows "Written by <name>" and "Suggested by <name>".

### 4. The options card

`EmbeddingSpaces` (`features/embeddingSpaces/ui`), placed on the options page, lists spaces from
`spaces.list` and calls `spaces.remove`. It shows sizes as KB or MB.

## Risks / Trade-offs

- **[A swap with no new vectors]** If the new model cannot embed a chunk, for example a failing
  job, coverage never reaches 100% and the session stays on the old space. That is the safe
  direction. The failed job is visible in the queue.
- **[Facts from two models in one session]** Pages extracted before and after a swap carry
  different producers. Their facts are kept, and every summary and table cell already shows its
  sources. REQ-LIN-007 allows cells from different runs.

## Migration Plan

No migration: the new space fields are optional. Rollback leaves `retiredAt` and `removedAt`
ignored.
