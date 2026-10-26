# Tasks

## 1. Reading source details

- [x] 1.1 Add `readPageSourceDetails(database, nodeIds)` to `pageMetadata`: per node, the site name and a publication date that parses (`Date.parse`, between 1990 and now) as a UTC calendar date plus its timestamp; verify specs for a full record, no record, an unparsable date, a future date, a date before 1990 and a mix of nodes.

## 2. The comparison table

- [x] 2.1 Add `siteName?` and `publishedAt?` to a table source and to `TableFact`; read them in `readComparisonTable`; verify specs that sources carry them and a page without metadata carries none.
- [x] 2.2 Mark the newest group of a conflicting cell (`isNewest`) with the rules of the design (two dated groups, strictly later, no change to value, order, count or flag); verify `buildCell` specs for a newer source, one dated group, a tie and a non-conflict.
- [x] 2.3 Show the site and date on a source and a "newest source" tag in the table component, and put them in the CSV's sources column; verify component and CSV specs, including a source without details.

## 3. The summaries

- [x] 3.1 Add the same two fields to a summary citation, read them in `readSummariesView` and show them in the citation line; verify specs for a citation with and without details.
- [x] 3.2 Verify, in a `clusterSummaries` spec, that a page's metadata arriving after a summary leaves the summary not stale and the fact set hash and the prompt's messages unchanged.

## 4. End to end and docs

- [x] 4.1 No new e2e: the suite has no generation model, so no fact can appear in the table or the summaries, and the views are covered by the model and component specs of 2.1–3.2. Run the existing `summaries` and `accessibility` e2e specs to check both pages still render and pass the audit; verify they pass.
- [x] 4.2 Document the source details in `RESEARCH_GRAPH_EXTENSION_SPEC.md`; verify `openspec validate show-page-source-details` passes.
- [x] 4.3 Run `npm run verify`; report anything not run.
