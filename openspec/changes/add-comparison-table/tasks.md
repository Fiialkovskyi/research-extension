# Tasks

## 1. Storage

- [x] 1.1 Add `StoredTableColumns` and the `tableColumns` store with a `sessionId` index (migration 17), and add the store to `deleteSession`. Verify with the migration and `deleteSession` specs.

## 2. Table model (pure parts)

- [x] 2.1 Create `features/comparisonTable` with `isSameValue` (design decision 3). Verify with specs for:
  - numbers within 5%;
  - numbers just over 5%;
  - different units;
  - grams against kilograms;
  - miles against kilometres;
  - text after normalisation;
  - a number against text.
- [x] 2.2 Add `buildCell` (design decision 4). Verify with specs for:
  - agreement;
  - a conflict with its groups;
  - the majority choice;
  - ties broken by pages, then by order;
  - no drift through a chain of near values;
  - sources kept per value.
- [x] 2.3 Add `proposeColumns` (design decision 2). Verify with specs for:
  - ranking by rows;
  - merging spellings by key;
  - the label being the most frequent spelling;
  - the cap of 8;
  - saved columns overriding, with stale keys dropped.
- [x] 2.4 Add `buildComparisonCsv` (design decision 6). Verify with specs for:
  - the header;
  - quoting;
  - doubled quotes;
  - newlines;
  - every formula trigger;
  - the conflict note;
  - the sources column;
  - CRLF and the BOM.

## 3. Reading and saving

- [x] 3.1 Add `readComparisonTable(database, entityType?)`. It decrypts the session's facts, groups them by root entity and type, picks the type, and builds columns and cells. Verify with specs for:
  - the default type;
  - choosing another;
  - merged entities forming one row;
  - entities without facts left out;
  - available attributes;
  - no session.
- [x] 3.2 Add `saveTableColumns` (design decision 5). Verify with specs: saving encrypts, an empty list removes the record, and a read uses the saved columns.

## 4. Background

- [x] 4.1 Add `table.read` and `table.setColumns` to `app/backgroundApp`, with their schemas. Verify with background specs: the table is read from extracted facts, and saving columns changes the next read.

## 5. Page

- [x] 5.1 Add the `ComparisonTable` component (design decision 7). Cover:
  - type selection;
  - cells with alternatives and conflicts;
  - sources per cell;
  - removing and adding a column;
  - Export.

  Verify with component specs.

- [x] 5.2 In `app/summariesApp`, render both sections, request `table.read` and `table.setColumns`, and perform the Blob download. Rename the heading and the popup button to "Synthesis". Verify with app and popup specs. Extend `summaries.e2e.ts` to check the renamed button and the table section's empty state.

## 6. Documentation and verification

- [x] 6.1 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`: tick "Generic comparison table with conflicts and CSV export", and record the agreement rule, the greedy grouping and the CSV format. Verify that `openspec validate add-comparison-table --strict` passes, apart from the archive-order note.
- [x] 6.2 Run `npm run verify` and confirm that it passes.
