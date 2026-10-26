# Proposal

## Why

Models will be swapped: a better embedding model, a newer `qwen`. Section 7 of the target spec
says a swap must never silently mix or overwrite outputs. Today the code breaks that in two ways.

- **Embedding swap (REQ-LIN-003).** A session takes the space of its first vectors and keeps it
  forever. `claimSessionEmbeddingSpace` only claims when the session has no space yet. After
  another embedding model is activated, its vectors are computed, but similarity, clustering and
  reattach keep using the old space. Old spaces are also never released (REQ-LIN-004).
- **Generation swap (REQ-LIN-005).** Activating another generation model re-extracts every page
  and regenerates every summary and question set at once, because their jobs are keyed by model.
  Existing statements should instead stay visible, labelled with their producer, and be
  regenerated only on request or when their inputs change.

## What Changes

- **Embedding swap.**
  - When the active embedding model's space covers every chunk of the active session, the
    session switches to it in one write. Until then it keeps using its current space, which is
    then retired.
  - This is checked after embedding jobs run, and when a model is activated.
- **Retention.**
  - A retired space keeps its vectors for 14 days, or until the user removes it.
  - The options page gains an "Embedding spaces" card: each space's model, vector count and
    approximate size, whether it is in use or retired and since when, and "Remove" for a retired
    one.
  - Expired spaces are purged when the background starts, and by the job wake-up.
- **Generation swap.**
  - Fact extraction is queued only for pages never extracted, by any model.
  - Summaries and questions are queued only when their facts change, not when the model does.
  - Existing ones show their producer, for example "Written by qwen3:4b". "Refresh" and
    "Summarize now" still use the active model.
  - A summary whose model is no longer installed stays stale, as REQ-LIN-006 requires.

## Capabilities

### New Capabilities

- `model-swap`: what happens to a session's vectors and to generated statements when the
  active embedding or generation model changes, and how retired spaces are kept and removed.

### Modified Capabilities

None. The behaviours of the earlier changes that this one adjusts — when extraction, summaries
and questions are queued — are stated in `model-swap`, whose requirements take precedence for a
model change.

## Impact

- **Code:**
  - `researchSession` gains `switchSessionSpace`, and keeps `claimSessionEmbeddingSpace` for the
    first claim;
  - `snapshotEmbeddings` gains `readSpaceCoverage`;
  - a new `features/embeddingSpaces/` with `readSpaceUsage`, `removeSpace` and
    `purgeRetiredSpaces`;
  - `StoredSpace` gains `retiredAt?` and `removedAt?` (no migration: optional fields);
  - `factExtraction/enqueueFactExtractions`, `clusterSummaries/enqueueClusterSummaries` and
    `openQuestions/enqueueOpenQuestions` change their skip rules;
  - the summary and question views add `modelName`;
  - `app/backgroundApp` runs the switch and the purge, and answers `spaces.list` and
    `spaces.remove`;
  - the options page shows the card.
- **Tests:**
  - unit specs for coverage, switching, retiring, purging and the new enqueue rules;
  - background specs for a full embedding swap and for a generation swap leaving statements in
    place;
  - component specs for the card and the producer labels.
