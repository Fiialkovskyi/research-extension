# Tasks

## 1. Storage and the fact's type

- [x] 1.1 Add `StoredEntity`, the `entities` store, `StoredFact.entityId`, and migration 15 with the `sessionId` index on entities and the `entityId` index on facts. Verify with the migration spec: a version-14 profile upgrades, keeps its facts, and the new store and index exist.
- [x] 1.2 Store `entityType` in the encrypted fact text: the subject's type from the answer's entities matched by normalised name, or `unknown`. Add a reader that decrypts a fact and defaults a missing type to `unknown`. Verify with `runFactExtractionJob` and reader specs for:
  - a listed subject;
  - an unlisted one;
  - an old fact without a type.

## 2. Entity resolution (pure parts)

- [x] 2.1 Add `normalizeEntityName` (design decision 3) as `shared/normalizeEntityName`, since `factExtraction` needs it to match subjects to their types and `entityResolution` reads facts from `factExtraction`; a feature-level copy would make the two import each other. Verify with specs for:
  - case;
  - quotes and inch marks;
  - punctuation;
  - NFKC widths;
  - Cyrillic;
  - kept decimals such as "2.5".
- [x] 2.2 Add `readNormalizedValue(value, unit)` (design decision 7). Verify with a table spec covering:
  - every unit family;
  - a decimal comma;
  - thousands separators;
  - mixed separators;
  - `%`;
  - a currency;
  - an unknown unit;
  - non-numeric values.
- [x] 2.3 Add `matchEntity`: name match, then the best same-type similarity of at least 0.85 against roots, honouring separation, with similarities injected. Verify with specs for:
  - a name match, including `unknown` adopting a type;
  - a type clash;
  - a match above the threshold;
  - one below it;
  - no embedding;
  - a separated pair.

## 3. The job and separation

- [x] 3.1 Add `enqueueEntityResolution` and `runEntityResolutionJob` (design decisions 4 and 6), with the embedding session and data key injected. Verify with specs for:
  - new entities, encrypted;
  - a name match across two pages;
  - a merge by meaning recorded as `mergedInto`;
  - a rerun skipping assigned facts;
  - no embedding model.
- [x] 3.2 Add `separateEntity` (design decision 5). Verify with specs: it clears `mergedInto`, sets `isSeparated`, and a later run does not merge the two again.

## 4. Background

- [x] 4.1 Wire the feature into `app/backgroundApp`:
  - the `resolveEntities` runner, run held, with the active embedding model through `loadEmbeddingSession` when there is one;
  - enqueueing from the extraction runner when a page finishes, and from `queueSnapshotWork`;
  - `entity.separate`.

  Verify with background specs: entities appear once a page's extraction finishes, and separating works. A second page joining the first page's entity is covered by the job's own specs (`runEntityResolutionJob`), since driving a second captured tab through the background spec adds nothing the job spec does not check.

## 5. What was recorded

- [x] 5.1 Deletion: `deleteNode` removes entities left without facts and clears dangling `mergedInto`; `deleteSession` covers entities. Verify with their specs.
- [x] 5.2 Make `readRecordedSession` include the session's root entities, decrypted: name, type, fact and page counts, and merged names with their ids. Verify with specs.
- [x] 5.3 Add the "Entities" section to the recorded page, with "Separate" sending `entity.separate`, then reading again. Verify with component and app specs. Extend `recordedData.e2e.ts`: with no generation model, the section says no entities were found yet.

## 6. Documentation and verification

- [x] 6.1 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`: tick "Entity resolution and unit normalization", and record the unit table and the separation rule in the SYN section. Verify that `openspec validate add-entity-resolution --strict` passes.
- [x] 6.2 Run `npm run verify` and confirm that it passes.

## Deferred

The maintainer deferred the manual run on 2026-10-13 ("оставь ручные проверки на потом"); it is carried to follow-up work rather than left open here.

- With `qwen3:4b` and `nomic-embed-text` active, extract two pages about the same product from different shops. Record in design.md Findings the entities produced, any wrong merges or misses, and whether "Separate" fixed them.
