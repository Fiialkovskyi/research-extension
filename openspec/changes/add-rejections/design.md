# Design

## Context

- **Facts.** A fact's text is encrypted, and `readSealedFact` gives subject, attribute, value and
  unit.
- **Where facts are read.**
  - `comparisonTable/readComparisonTable` decrypts every fact of the session.
  - `clusterSummaries/readClusterFactIds` lists fact ids by page, without decrypting. It feeds
    the fact-set hash (staleness and supersession) and the summary input.
  - `readSummariesView` resolves citations by fact id.
- **Normalisers.** `normalizeEntityName` (`shared/`) and `readNormalizedValue`
  (`entityResolution`, `unitNormalizer@1`).

## Goals / Non-Goals

**Goals:**

- One rejection that holds across models, spellings and units. It hides the value everywhere and
  can be undone.

**Non-Goals:**

- Rejections that hold across sessions, and rejecting a statement's wording.

## Decisions

### 1. The key (`getFactKey`)

The key is SHA-256, as hex, of
`normalizeEntityName(subject) | normalizeEntityName(attribute) | value`. The value part is
`<number> <unit>` from `readNormalizedValue`, with the number rounded to 6 significant digits,
when the value reads as a number. Otherwise it is `normalizeEntityName(value + " " + unit)`.

- **Exact equality, no tolerance.** The table's 5% agreement is for grouping, not identity: two
  different values within 5% may both be real, and rejecting one must not hide the other.
- **Version.** `factKey@1` is noted in the module. A later rule would need rejections stored
  again, so the rule is kept stable.

### 2. Storage (migration 18)

The `rejections` store is keyed `<sessionId>:<key>`, with a `sessionId` index, and holds
`{ id, sessionId, key, createdAt }`. The key is a hash, so nothing in the store is readable
content. `deleteSession` adds the store to its session-scoped list.

### 3. Rejecting and restoring

- **`facts.reject { factIds }`.** The background decrypts the facts, computes their keys and puts
  one rejection per distinct key.
- **`facts.restoreRejections {}`.** It clears the active session's rejections.
- **After either.** `enqueueClusterSummaries` runs, since a fact set may have changed, so stale
  summaries are queued on the usual 60 s debounce.

### 4. Filtering

- **The helper.** `filterRejectedFacts(facts, rejectedKeys)` takes facts with their decrypted text
  and keeps those whose key is not rejected. `readRejectedKeys(database, sessionId)` returns a
  `Set`.
- **The table.** `readComparisonTable` filters before building rows, which removes the values from
  cells, gaps and the CSV in one place.
- **Summaries.**
  - `readClusterFactIds(database, dataKey, cluster)` now decrypts each fact of the cluster's pages
    and leaves rejected ones out. All its callers pass the data key, so the fact set, the
    supersession check, the summary input and staleness all exclude rejected facts.
  - `readSummariesView` drops citations whose fact is rejected. A statement left with no
    citation is still shown, since its summary is stale and about to be replaced.
- **Later extractions.** Facts are kept, and the filter runs on read, so a fact any model extracts
  later with the same key is hidden without further work.

### 5. The page

- **"Wrong".**
  - The comparison table's value list shows "Wrong" beside each value, which sends
    `facts.reject` with that value group's fact ids.
  - Summary citations show "Wrong", which sends that citation's fact id.
- **The count.** `table.read` answers `rejectedCount`, the number of the session's rejections. The
  page shows "N values marked wrong · Restore all" when it is above zero.
- **Re-reading.** After rejecting or restoring, the app reads summaries, the table and the gaps
  again.

## Risks / Trade-offs

- **[Decrypting on every fact-set read]** `readClusterFactIds` now decrypts, which costs
  milliseconds for session-sized data. It is called on enqueue, on read and in the job.
- **[Rejecting the majority value]** Then the next value shows. That is the point: the user knows
  better.

## Migration Plan

Version 18 adds `rejections`. Nothing else changes. Rollback ignores the store, and rejected
facts reappear.

## Findings

- **One unreadable record failed the whole table.** In the background specs, a job left running by
  an earlier test wrote records under a data key the next test had replaced. `table.read` then
  answered `rpc.failed`, and the page lost its table. Real profiles keep one key, but a single
  corrupt record should not blank the page either. So `readComparisonTable` now leaves out an
  entity or fact that fails authentication, and `readSavedColumns` treats an unreadable choice as
  none. Both behaviours have specs.
- **Store clearing between specs.** The background specs now also clear rejections and table
  columns between tests.
