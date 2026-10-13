# Design

## Context

- **Facts.** Facts hold `subject`, `entityType`, `attribute`, `value`, `unit?` and `quote`,
  encrypted (`readSealedFact`). Each has an `entityId`; the entity's `mergedInto` gives the root
  (`add-entity-resolution`).
- **Normalisation.** `readNormalizedValue(value, unit)` (`unitNormalizer@1`) gives
  `{ number, unit }` or nothing. `normalizeEntityName` (`shared/`) is the name-and-text
  normaliser: NFKC, case folding, punctuation and whitespace.
- **The page.** The Summaries page (`app/summariesApp`, `features/clusterSummaries/ui`) reads one
  `summaries.read` answer. The popup opens it through `summaries.open`.
- **Archive order.** `add-cluster-summaries` is not archived. This change's `cluster-summaries`
  delta modifies a requirement that change adds, so it must be archived after it, as noted in the
  proposal.

## Goals / Non-Goals

**Goals:**

- A correct, inspectable table from facts alone, with honest conflicts and a CSV that keeps its
  provenance.

**Non-Goals:**

- Attribute synonyms beyond normalisation, such as "weight" and "mass". A later change can merge
  them by embedding, as entities are.
- Choosing a value by source quality, editing cells, and currency conversion.

## Decisions

### 1. Computed on read, in the background

`table.read { entityType? }` returns the table in one answer:

- the types the session's entities have, each with a row count;
- the chosen type and its rows;
- the columns and every cell, with the cell's values and sources decrypted;
- the other attributes the type offers, for adding a column.

The background decrypts the session's facts once per read. A session holds hundreds of facts at
most, so this costs milliseconds. Nothing is cached, so the table cannot go stale.

### 2. Attribute keys and column proposal

- **Attribute key.** `normalizeEntityName(attribute)`. The column label is the most frequent
  original spelling among its facts.
- **Proposal.** `proposeColumns(facts, rows)` ranks the attribute keys of the type's facts by how
  many distinct rows have them, then alphabetically, and takes the first 8.
- **Saved columns.** When the user has saved columns for this session and type, those are shown in
  the user's order, and any saved key the facts no longer have is dropped from view.

### 3. Values that agree (`isSameValue`)

Two values agree when either holds:

- both normalise to numbers with the same normalised unit, and
  `|a − b| ≤ 0.05 × max(|a|, |b|)`;
- neither normalises to a number, and `normalizeEntityName(value + " " + unit)` is equal.

A number never agrees with text, and numbers in different units never agree.

### 4. Cells (`buildCell`)

1. **Grouping.** A cell's facts are grouped greedily, in fact-id order: a fact joins the first
   group whose first value it agrees with. The first value is used because a chain of values each
   within 5% of the next could otherwise drift.
2. **Selection.** The selected group has the most facts. Ties go to the group from more pages,
   then to the earlier first fact.
3. **What the cell shows.** The selected group's first value as written, with its unit. Its
   `alternativeCount` is the number of groups minus one, and `isConflict` is true when there is
   more than one group.
4. **What the cell holds.** Every group, with its facts' page title, URL and quote, so the page can
   list them.

### 5. Column settings (migration 17)

- **Store.** `tableColumns` is keyed `<sessionId>:<typeKey>`, with an index on `sessionId`. It
  holds `{ sessionId, keyId, iv, encryptedColumns }`, where `encryptedColumns` is the JSON list of
  attribute keys. The type key is the normalised type, and the type itself is not stored
  readable. Attribute keys are page-derived, so they are encrypted.
- **`table.setColumns { entityType, columns }`** replaces the list. An empty list removes the
  record, which returns the table to the proposal.
- **Deletion.** `deleteSession` adds the store to its session-scoped list.

### 6. CSV (`buildComparisonCsv`)

- **Columns.** `Entity`, then `<label>` and `<label> sources` for each column.
- **Values.** A value cell holds the selected value, with ` (conflict: N values)` appended when it
  conflicts. A sources cell holds the cell's distinct source URLs, separated by spaces.
- **Fields.** Each field is quoted when it contains `"`, `,`, `\r` or `\n`, with `"` doubled.
  A field starting with `=`, `+`, `-`, `@`, a tab or a carriage return is prefixed with `'`.
- **Lines.** Lines end with CRLF, and the file starts with a UTF-8 BOM, so Excel reads Cyrillic
  correctly.
- **Download.** The page builds a `Blob` (`text/csv;charset=utf-8`), an object URL, and an anchor
  with `download="<session title> — <type>.csv"`, clicks it, then revokes the URL. A download
  from an extension page needs no `downloads` permission.

### 7. The page

- **Renaming.** The page's heading is now "Synthesis: <title>", and the popup button reads
  "Synthesis". The `open-summaries` test id and `summaries.html` stay, so the e2e and open tabs
  are unaffected.
- **`app/summariesApp`** requests `summaries.read` and `table.read` together, and renders
  `ClusterSummaries`, then `ComparisonTable`.
- **`ComparisonTable`** (`features/comparisonTable/ui`) shows:
  - a type selector;
  - the table: rows and cells, with a cell's alternative count and a "conflict" mark;
  - each cell's sources and every value, in a `<details>` per cell;
  - a remove button on each column header, and an "Add column" select of the other attributes;
  - "Export CSV".

  Like `ClusterSummaries`, it takes no client, so a sidebar can reuse it.

## Risks / Trade-offs

- **[Synonyms split columns]** "weight" and "mass", or "ціна" and "price", become separate
  columns. → The user can add and remove columns. Synonym merging is a non-goal here and is
  recorded for later.
- **[Selecting by majority]** When two sources each say something different, the earlier one wins
  the tie. → Such a cell is always flagged as a conflict and lists both, so nothing is hidden.
- **[Decrypting on every read]** → It is bounded by session size. If it ever shows in profiling,
  a per-session cache keyed by the fact-set hash is the obvious step, and it changes nothing
  observable.
- **[CSV injection]** → The prefix rule (decision 6) is tested for each trigger character.

## Migration Plan

- Version 17 adds `tableColumns`. Nothing existing changes.
- Rollback: the store is ignored, and the page shows the summaries alone.
