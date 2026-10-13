# Proposal

## Why

Synthesis now says what was found, but not what is still missing:

- a laptop with no price recorded;
- comparisons made only from shop pages, with no review read.

Gaps (REQ-SYN-008) turn the table's empty cells, and the kinds of source the session never
visited, into concrete next steps. "Search this" (REQ-SYN-009) runs each of them as a search, in
the session's own tab group, so the result is captured like any other search.

## What Changes

- **Gaps from empty cells.** For the comparison table's current type and columns, each confirmed
  entity's empty cell is a gap: "No price for MacBook Neo 13". An entity is confirmed when at
  least two pages state facts about it, so a single passing mention does not fill the list with
  empty cells.
- **Gaps from source categories.**
  - A bundled, versioned lookup, `domainCategories@1`, sorts a page's host into review, forum,
    video, retailer, reference, news or other.
  - Each of review, forum, video, retailer and reference that no page of the session falls into
    is a gap: "No reviews read yet".
  - Manufacturer sites cannot be recognised from the host alone, so they are left out, rather
    than guessed.
- **Search this.**
  - Each gap has a generated query: the entity and attribute for a cell, and the session's most
    common entity or its title plus a category word for a category.
  - "Search this" opens the query's results page in a new tab in the session's group, so capture
    records it as the session's next search.
  - It uses the engine the session's own searches used most, or DuckDuckGo when there were none.
  - The extension opens a tab and makes no request of its own. It needs no `search` permission.
- **Where they show.** A "Gaps" section on the Synthesis page, below the table. Gaps are computed
  when read, like the table, so they are never stale. The page shows at most 20 cell gaps, and
  says how many more there are.
- **Search URLs in the engine table.** Each bundled search engine gains a URL template for
  building its results page.

## Capabilities

### New Capabilities

- `research-gaps`: how gaps are found from empty cells and missing source categories, how each
  is phrased as a query, and how "search this" opens it inside the session.

### Modified Capabilities

None. The section's place on the Synthesis page is stated in `research-gaps`, so this change does
not modify the unarchived `cluster-summaries` delta.

## Impact

- **Code:**
  - a new `features/researchGaps/`:
    - `readDomainCategory` and its lookup table;
    - `findCellGaps`, `findCategoryGaps` and `buildGapQuery`;
    - `readResearchGaps`;
    - `ui/researchGaps`;
  - `shared/config/searchEngines` gains `searchUrl` per engine;
  - `app/backgroundApp` answers `gaps.read` and `gaps.search`;
  - `app/summariesApp` renders the section.
- **Tests:**
  - unit specs for the lookup, cell gaps, category gaps, queries, the engine choice and URL
    building;
  - background specs for reading gaps and for opening a search in the session's group;
  - component and app specs;
  - an e2e check that "Search this" opens a results page inside the session's group and capture
    records it. The suite's page server already answers search hosts offline.
- **Out of scope:**
  - questions the model proposes ("labelled as suggestions", optional in REQ-SYN-008), to be done
    later behind the generation gate;
  - recognising manufacturer sites;
  - a user-editable category table.
