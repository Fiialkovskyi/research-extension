# Proposal

## Why

Facts are now extracted per page, but each page names things its own way. One shop writes
`Apple MacBook Neo 13"`, a review writes `MacBook Neo 13`. One page says `1,2 кг`, another `1200 g`.
The next M4 steps — cluster summaries, the comparison table and its conflict check (more than 5%
apart after unit normalisation, REQ-SYN-006) — need one entity per real thing, and values in
comparable units. This is step 6 of the synthesis pipeline: entity resolution and unit
normalisation.

## What Changes

- **Entity types are kept.** `factExtraction@1` already returns each entity's `entity_type`, but
  extraction discards it. A fact now stores its subject's type, encrypted with the rest of its
  text. Facts stored before this change read as type `unknown`.
- **Entities per session.**
  - A new `resolveEntities` job runs after a page's extraction finishes. It gives each new fact an
    entity of the session.
  - Matching is first by normalised name: Unicode-normalised, case-folded, quotes and punctuation
    removed, spaces collapsed.
  - Otherwise it matches by the similarity of the names' embeddings: at least 0.85 in the active
    embedding space, and only between entities of the same type.
  - Without an active embedding model, only names are matched.
  - Entity names are encrypted at rest like fact text.
- **Merges are reversible.** An entity that matched another is recorded as merged into it; it is
  not deleted. From "What was recorded", the user can separate a merged name again. A separated
  entity is not merged back automatically.
- **Unit normalisation** (`unitNormalizer@1`). A pure, versioned reading of a fact's value and unit
  into `{ number, unit }`:
  - decimal comma or point, and thousands separators, are read as the value they write;
  - mass becomes kg, length mm, distance km, energy Wh, power W, torque N·m, and time s;
  - percentages and currency codes are kept as written.

  A value it cannot read has no normalised form. It is computed when a fact is read, not stored,
  so a new version recomputes everything.

- **What was recorded.**
  - An "Entities" section lists the session's entities: name, type, how many facts and pages, and
    the names merged into each, with "Separate".
  - Deleting a page removes its facts from their entities. An entity left without facts is
    removed.

## Capabilities

### New Capabilities

- `entity-resolution`: how a session's facts are grouped into entities, how merges are made and
  undone, and how values are normalised into comparable units.

### Modified Capabilities

- `fact-extraction` (from `add-fact-extraction`, not yet archived): a stored fact also records its
  subject's entity type. This is added as a new requirement, so it applies whether or not that
  change is archived first.
- `recorded-data`:
  - the "What was recorded" page lists the session's entities, and lets the user separate a merge;
  - deletion also covers entities.

## Impact

- **Code:**
  - a new `features/entityResolution/`:
    - `normalizeEntityName`, `readNormalizedValue`, `matchEntity`;
    - the job and its enqueue;
    - `separateEntity`;
  - `factExtraction` stores the subject's type;
  - `shared/storage` gains an `entities` store and an `entityId` index on facts (migration 15);
  - `app/backgroundApp`:
    - the job runner;
    - enqueueing when an extraction finishes;
    - `entities.read` and `entity.separate`;
  - `recordedData`: deletion, plus the entities section of the recorded page.
- **Model use:** names are embedded with the active embedding model, as documents, a few at a
  time. That is no new model and no network beyond Ollama's loopback, which is already allowed.
- **Tests:**
  - unit specs for name normalisation, value normalisation (a table of units), matching, the job,
    separation and deletion;
  - background specs with a stub embedding session;
  - an e2e check that the recorded page shows no entities when no generation model is active.
- **Out of scope:**
  - currency conversion;
  - choosing which fact wins when sources disagree (the comparison table);
  - merging entities across sessions;
  - review UI for facts beyond counts.
