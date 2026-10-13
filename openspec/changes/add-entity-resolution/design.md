# Design

## Context

- **Facts as stored today.** `add-fact-extraction` stores a fact's text (`subject`, `attribute`,
  `value`, `unit?`, `quote`) encrypted in `StoredFact.encryptedFact`. Ids, page, session and
  provenance are readable.
  - The answer's `entities` list, which carries each entity's `entity_type`, is validated and then
    discarded (`runFactExtractionJob`).
  - An extraction record marks a page finished with `finishedAt`.
- **Embedding.** `loadEmbeddingSession(model).embed(texts, role)` embeds texts with the active
  embedding model, through the worker or Ollama. `compareVectors` gives cosine similarity within
  one space.
- **Job runner.** The runner dispatches by type, runs each job held, and gates text generation on
  idleness. Name embedding is short work, not generation, so `resolveEntities` is not gated.
- **Archive order.** `add-fact-extraction` is not archived yet. This change's `recorded-data`
  deltas repeat its fact wording plus entities, so it must be archived after that change.
  `fact-extraction` is touched only through an ADDED requirement.

## Goals / Non-Goals

**Goals:**

- One entity per real thing within a session, built incrementally as pages finish extracting,
  reversible by the user.
- A pure, versioned unit normaliser that the comparison table can rely on.

**Non-Goals:**

- Cross-session entities, currency conversion, and picking a winning value among conflicts.
- Re-resolving everything after an embedding-model swap. Entities keep the matches they made. A
  later change can re-run resolution when the active space changes.

## Decisions

### 1. Keep the type on the fact

`runFactExtractionJob` looks up each fact's `subject` among the answer's `entities` by normalised
name (decision 3) and stores that entity's type as `entityType` inside the encrypted text. A
subject that is not listed gets `"unknown"`, and so does any fact read without the field. The
prompt does not change, so it is still `factExtraction@1`; only what is kept from its answer
changes. Facts already stored read as `unknown`.

### 2. Storage: entities, and an entity on each fact (migration 15)

- **`entities` store** (`StoredEntity`):
  - `id` (UUID), `sessionId`;
  - `mergedInto?`, the id of the entity this one was merged into;
  - `isSeparated`: once true, the entity is never merged by meaning again (decision 5);
  - `keyId`, `iv`, and `encryptedEntity` = `{ name, type }`, encrypted;
  - `createdAt`;
  - index `sessionId`.
- **`StoredFact` gains `entityId?`**, readable, with an index `entityId`. It points at the entity
  the fact was first assigned to, never at a merge target. Following `mergedInto` gives the
  resolved entity. A merge therefore rewrites no fact, and undoing it is one field.
- **Why the type is encrypted.** It is a model's reading of page content. Matching decrypts the
  session's entities anyway, since a session holds tens of them, not thousands.

### 3. Name normalisation

`normalizeEntityName(name)` applies, in order:

1. NFKC;
2. `toLocaleLowerCase("und")`;
3. replace quotes, primes and punctuation (`\p{P}` and `\p{S}`, apart from `+`, `.` and `,`
   between digits) with spaces;
4. collapse whitespace and trim.

Version `entityName@1` is recorded in the job's producer version.

### 4. Matching (`matchEntity`)

For each fact without an entity, in fact-id order:

1. **By name.** Find a root entity (one with no `mergedInto`) whose normalised name equals the
   subject's, with an equal type or either side `unknown`. If found, the fact joins it. When the
   entity was `unknown`, it takes the known type.
2. **By meaning.** Otherwise, if an embedding model is active:
   - embed the new name, and the names of the session's root entities with the same type that have
     no cached vector, as `document`;
   - pick the best similarity of at least 0.85;
   - skip candidates that are the separated pair (decision 5).

   On a match, create the subject's own entity merged into the match, so it can be separated
   later, and assign the fact to it.

3. **Otherwise**, create a new root entity.

- **Name vectors.** They are cached in memory for the length of one job, not stored. They are only
  a means to match.
- **Batches.** Embeddings run in batches of up to 8, the embedding job's batch size.
- **Only one level of merging.** Merging into a root that is itself later merged is avoided:
  matches are only ever made against roots.

### 5. Separation

`entity.separate { entityId }` clears `mergedInto` and sets `isSeparated`. Facts are untouched,
since they already point at the separated entity.

_Revised during implementation._ No pair needs remembering. Matching only ever merges a new
subject's own, newly created entity; an existing entity never gets `mergedInto` again. A separated
entity therefore cannot be re-merged by construction, and `isSeparated` is kept as a record of the
user's decision. Later mentions of the same name join it by name, as they should.

Matching by name looks at every entity, merged ones included. Matching by meaning looks only at
roots. Otherwise a name seen again on a second page would match its merged entity's root by meaning
and create a duplicate of the merged entity.

### 6. The job

- **Identity.**
  - type `resolveEntities`;
  - inputs `[snapshotId]`;
  - producer version `entityName@1|<embedding model ref or "none">`.
- **When it is queued.** The extraction runner queues it when a page's extraction finishes, and
  `queueSnapshotWork` queues it for any finished extraction without one.
- **Run.**
  1. Decrypt the page's facts that have no `entityId`, and the session's entities.
  2. Match them (decision 4).
  3. Encrypt new entities, and write entities and fact `entityId`s in one transaction.
- **Idempotent.** A fact that already has an entity is skipped, so a rerun after an unload only
  finishes the rest.

### 7. Unit normalisation (`readNormalizedValue`, `unitNormalizer@1`)

`readNormalizedValue(value, unit)` returns `{ number, unit } | undefined`.

- **The number.**
  - Strip spaces and non-breaking spaces.
  - When both `,` and `.` appear, the last one is the decimal separator.
  - A lone `,` with exactly three digits after it is a thousands separator. Any other lone `,` is
    decimal.
  - A value with no digits, or with words in it, is not read.
- **The unit table, keyed by normalised unit spelling,** in English, Ukrainian and Russian:
  - mass: g, kg, lb, oz → kg;
  - length: mm, cm, m, in, `"` → mm;
  - distance: km, mi → km;
  - energy: Wh, kWh, mAh (kept as mAh, since it has no conversion without a voltage);
  - power: W, kW;
  - torque: Nm, N·m;
  - time: s, min, h;
  - storage: GB, TB → GB;
  - `%` and ISO currency codes are kept.
- **Anything else** is kept as written when the number reads, and is `undefined` when it does not.
- **When it runs.** It is computed when facts are read. No `value_norm` is stored, so a new version
  re-reads everything with nothing to migrate.

### 8. What was recorded

- **`entities.read`** returns the session's root entities, decrypted: name, type, fact count, page
  count, and the names merged into each with their ids. It is part of the recorded page's read, so
  one request draws the page.
- **The "Entities" section.** It sits below the pages, with "Separate" on each merged name.
- **Deletion.**
  - `deleteNode` deletes the page's facts, then any entity in the session with no fact left, then
    clears `mergedInto` on entities merged into one that was deleted.
  - `deleteSession` adds the entities store to its session-scoped list.

## Risks / Trade-offs

- **[Over-merging]** For example, "MacBook Air 13" and "MacBook Neo 13" may score above 0.85
  with a small embedding model. → The same-type rule and the 0.85 threshold limit it, and
  "Separate" fixes it permanently. The e2e and the manual run record any wrong merges seen.
- **[Under-merging]** Names in two scripts, such as "Ноутбук Apple MacBook" and "Apple MacBook",
  may not match by name. → Matching by meaning catches some. The rest stay separate, which is the
  safe direction.
- **[Unknown types]** Facts from before this change are `unknown`, and match by name only. →
  Re-extraction under a later prompt version fixes them. For development data this is acceptable.
- **[Thousands versus decimal comma]** `1,200` is read as 1200. → The documented rule, with table
  tests for each case.

## Migration Plan

- Version 15 adds `entities`, and the `entityId` index on `facts`. Existing facts have no entity
  until their page's `resolveEntities` runs, which `queueSnapshotWork` queues on the next start.
- Rollback: the store and the index are ignored, and queued `resolveEntities` jobs fail with "No
  runner".
