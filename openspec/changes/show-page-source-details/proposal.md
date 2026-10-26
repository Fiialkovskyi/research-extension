# Proposal

## Why

The comparison table and the cluster summaries cite pages as a title and a link. When two pages state different values for the same thing, or a summary leans on a few pages, the reader has to open each page to judge who said it and when. Every session page now keeps what it says about itself — the site's name, the date it was published, who wrote it — as `capture-page-metadata` stored it. Showing the site and the date beside each source turns a bare link into something a reader can weigh at a glance, and it costs no model call and changes nothing that was extracted.

## What Changes

- Each source in the comparison table (every value of a cell, and the CSV's sources column) names its page's site and publication date when the page gave them.
- Each citation in a cluster summary names its page's site and publication date likewise.
- A cell with conflicting values says which stated value comes from the newest dated source, so the reader sees a newer source disagreeing at a glance; it is a hint, never a choice: the cell's chosen value, its ranking and its conflict flag do not change.
- Nothing about what a model is asked changes: the summary prompt and the facts it is given stay as they are, so every statement still cites facts only and a summary is not made stale by this.
- A page without metadata shows its source as before.

## Capabilities

### New Capabilities

- `page-source-details`: how a source of a table cell or a summary citation names the site and the date of its page, and how a conflict points at the newest dated source.

### Modified Capabilities

None. The comparison table's and the summaries' own requirements are not changed; their sources gain two optional fields.

## Impact

- `comparisonTable` (the fact the table is built from, the value-group source schema, `readComparisonTable`, the CSV, the table component), `clusterSummaries` (the citation schema, `readSummariesView`, the citation line in the summaries component), and a small reader in `pageMetadata` that gives the site name and publication time of a set of nodes.
- No storage change, no new permission, no new message: it reads the `pageMetadata` records the earlier change stored.
- The summary prompt, the fact set hash and summary staleness are untouched.
