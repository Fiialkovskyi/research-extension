# Design

## Context

A comparison cell is built from facts: each fact has a `nodeId`, and `readComparisonTable` turns it into a source with the page's title and URL (`TableFact.pageTitle`, `.url`), grouped by value; `buildCell` ranks the groups and flags a conflict when more than one value remains. A summary statement cites fact ids, and `readSummariesView` resolves each to the page's title, URL and the fact's quote. `capture-page-metadata` stores, per node, the page's site name, publication time, author, type and canonical link in the clear (and a sealed description). Neither the table nor the summaries read it yet. Observed in `readComparisonTable`, `buildCell`, `buildComparisonCsv`, `readSummariesView` and the two components.

## Goals / Non-Goals

**Goals:**

- A reader can see, beside each source, which site it is and when it was published.
- In a conflict, a newer dated source is visible as such.
- No change to what is extracted, summarised, ranked or flagged.

**Non-Goals:**

- Feeding metadata to a model. The summary prompt asks for statements that cite facts and nothing else (grounding, REQ-SYN-011); a description is not a fact and cannot be cited, so it stays out of the prompt.
- Choosing a value because its source is newer or better known. A date is a hint to the reader; the ranking stays what it is.
- New columns of metadata (a "Published" column) or filters by type. A follow-up, if the source line proves useful.
- The author, `og:type` and canonical link beyond what a source line carries.

## Decisions

### 1. Read the metadata where sources are resolved, in one small helper

`readPageSourceDetails(database, nodeIds)` in `pageMetadata` returns, per node, `{ siteName?, publishedAt? }` from the stored records (no decryption: these fields are in the clear). Both `readComparisonTable` and `readSummariesView` already look the node up for its title and URL, so they call it once for the nodes they touch. The two features gain a dependency on `pageMetadata`'s barrel, which exports plain functions and types only.

### 2. Two optional fields on a source

A table source gains `siteName?` and `publishedAt?`; a summary citation gains the same two. Both are optional in the schemas: a page without metadata, and a record made before `capture-page-metadata`, give neither. The fields are display text.

### 3. The publication date is shown as a date, and trusted only as far as it parses

Pages write dates every way, and the metadata keeps the string as the page wrote it. The helper parses it with `Date.parse`; when it parses, the source shows a calendar date (`2026-05-01`, in UTC, so it reads the same everywhere) and carries a timestamp for comparison; when it does not parse, the source shows no date and takes no part in the newest-source hint. A date in the future or before 1990 is treated as unparsed: a wrong clock on a page should not claim to be the newest source.

### 4. The newest-source hint is per cell, and only in a conflict

For a cell with `isConflict`, the value group whose best dated source is newest gets `isNewest: true`, but only when at least two groups have a dated source and the newest date is strictly later than the next; otherwise no group is marked. The mark changes nothing else: `value`, the order of `groups`, `alternativeCount` and `isConflict` stay as `buildCell` made them. The table shows a small "newest source" tag on that group. A tie or a single dated source marks nothing, so the tag is not noise.

### 5. The CSV names sites and dates in its sources column

The sources column lists the source URLs; each URL is followed by its site and date in brackets when known (`https://example.org/a [Bike Lab, 2026-05-01]`). A source without them is the bare URL as before, so a file made from older data reads the same.

### 6. Summaries are not made stale

The fact set hash is made from fact ids, and the prompt from facts, neither of which changes. The citation line is a display of what is read at view time, so a page whose metadata arrives later shows it on the next read with no new summary.

## Risks / Trade-offs

- **Misleading dates.** A page's `article:published_time` can be wrong, missing or a modified time. Mitigation: parse strictly, ignore the implausible, call it a hint, and never let it change a value. Accepted.
- **Site names that are marketing.** `og:site_name` is the site's own wording. It is shown as a label, not used as an identity.
- **A little more reading per view.** One indexed read per source page, on a store that is small. Accepted.
- **Two features now depend on `pageMetadata`.** Through its barrel and plain functions only, so no runtime or DOM comes with it into the background.

## Open Questions

- Should the table offer a "Published" column or sort a conflict's values by date? Left to after the source line has been used.
- Should the author join the source line? Left out: it is often absent or a URL.
