# Proposal

## Why

Comparing things is what most research sessions are for: which e-bike, which laptop, which plan.
The session already has grounded facts, grouped into entities, with values readable in comparable
units. The comparison table (REQ-SYN-005…007) turns them into the view a user would otherwise
build by hand: one row per thing, one column per attribute. Each cell shows where its value came
from and says when sources disagree.

## What Changes

- **A comparison table, computed from facts when it is read.** No model runs to build it, so it is
  always current, and it needs no generation schedule and no staleness.
  - **Rows.** The session's entities of one type, chosen per table. By default it is the type with
    the most entities. A type selector lists the session's other types.
  - **Columns.** Proposed from the attributes most entities of that type have, compared after
    normalisation, with at most 8 at first. The user can remove a column, or add any other
    attribute that the type's facts have. The choice is kept per session and type, encrypted,
    since attribute names come from page content. Migration 17 adds its store.
  - **Cells.**
    - The selected value is the one most facts agree on.
    - The cell counts the alternatives.
    - Values agree when, after `unitNormalizer@1`, numbers are within 5% in the same unit, or when
      text is equal after normalisation.
    - A cell whose values disagree beyond that is flagged "conflict" and lists every value with
      its sources (REQ-SYN-006).
    - Every cell can show its sources: page and quote.
- **CSV export.** "Export CSV" downloads the table with a sources column beside each attribute
  column, holding the cell's source URLs (REQ-SYN-007).
  - It uses a Blob link on the extension page, so no new permission is needed.
  - Cells are quoted per RFC 4180.
  - A cell starting with `=`, `+`, `-` or `@` is prefixed, so a spreadsheet does not run it as a
    formula.
- **One synthesis page.**
  - The Summaries page becomes "Synthesis", with two sections: summaries, then the table. The
    popup's button is renamed with it.
  - The page path stays `summaries.html`, so open tabs and the e2e helpers keep working.

## Capabilities

### New Capabilities

- `comparison-table`: how the table is built from facts, how columns are proposed and edited,
  how cells pick a value and flag conflicts, and how the table is exported.

### Modified Capabilities

- `cluster-summaries` (from `add-cluster-summaries`, not yet archived): the page and the popup's
  button are named "Synthesis", and the page also holds the comparison table. This change must be
  archived after `add-cluster-summaries`.

## Impact

- **Code:**
  - a new `features/comparisonTable/`:
    - `model/`: `readComparisonTable`, `proposeColumns`, `buildCell`, `isSameValue`,
      `buildComparisonCsv` and `saveTableColumns`;
    - `ui/comparisonTable`;
  - `shared/storage` gains `tableColumns` (migration 17);
  - `app/backgroundApp` answers `table.read`, `table.setColumns` and `table.setType`;
  - `app/summariesApp` renders both sections and does the download;
  - the popup's button and the page's title are renamed;
  - `recordedData/deleteSession` covers the new store.
- **Tests:**
  - unit specs for column proposal, value comparison, cell building, CSV (quoting, formulas,
    sources) and the table read;
  - component and app specs;
  - an e2e check that Synthesis shows the table section, and that the popup button is renamed.
- **Out of scope:**
  - gaps and open questions;
  - rejections;
  - merging attribute synonyms (for example "weight" and "mass") beyond normalisation;
  - currency conversion;
  - editing cell values by hand.
