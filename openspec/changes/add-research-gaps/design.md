# Design

## Context

- **The table.** `readComparisonTable(database, entityType?)` gives the current type, the columns
  and, per row, its cells by column key. A missing key is an empty cell. Rows are root entities,
  and each cell's groups carry their sources' pages.
- **Nodes.** A node records `url` and `domain`. A SERP node also records its `query`. Which
  engine served a SERP is not stored, but it can be read again from the node's URL with the
  engine table `SEARCH_ENGINES` (hosts and result paths).
- **Opening tabs.** The background already opens and groups tabs through
  `dependencies.tabGroups` (`createTab`, `groupTabs`, `getGroup`). A tab added to the session's
  group is captured by the existing listeners, and a results page becomes a SERP node.
- **The e2e harness.** `network.dns.localDomains` maps the search hosts to the local page
  server, which answers results pages offline.

## Goals / Non-Goals

**Goals:**

- Gaps that are always current and cheap: computed on read, with no model.
- A "search this" that keeps the user inside the session and its capture.

**Non-Goals:**

- Questions proposed by the model (deferred, see the proposal).
- Manufacturer detection, and categories the user can edit.

## Decisions

### 1. The category lookup (`domainCategories@1`)

`readDomainCategory(hostname)`:

- lowercases the host and strips `www.`;
- matches it against a bundled table of exact hosts and suffixes;
- falls back to a few unambiguous patterns, `forum.*`, `*.forum.*`, `forums.*` and
  `community.*`, which mean forum.

**The table:**

| Category  | Hosts                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| review    | rtings.com, notebookcheck.net, techradar.com, tomsguide.com, pcmag.com, cnet.com, electrek.co, bikeradar.com, ixbt.com, itc.ua                                     |
| forum     | reddit.com, stackexchange.com, stackoverflow.com, 4pda.to, forum.*, quora.com, hardforum.com                                                                       |
| video     | youtube.com, youtu.be, vimeo.com, tiktok.com                                                                                                                       |
| retailer  | amazon._, ebay._, bestbuy.com, walmart.com, aliexpress.com, rozetka.com.ua, telemart.ua, comfy.ua, foxtrot.com.ua, allo.ua, citrus.ua, hotline.ua, prom.ua, olx.ua |
| reference | wikipedia.org (any language), wikidata.org, britannica.com                                                                                                         |
| news      | bbc.com, reuters.com, theverge.com, engadget.com, arstechnica.com                                                                                                  |

- **Hosts only.** Only hosts are matched, never paths, so a news site's review section counts as
  news. That is accurate enough to name a missing category.
- **Ownership.** The table lives in `features/researchGaps/constants.ts`, with its version.

### 2. Confirmed entities and cell gaps (`findCellGaps`)

For each row of the current table whose cells' sources, across all its facts, span at least two
pages, each shown column with no cell is a gap `{ kind: "cell", entity, attribute }`.

- **Page counting.** Only a row's cells are known, so a row's pages are counted from its cells'
  sources. Facts in columns not shown do not count. This is enough: a confirmed row with all
  shown columns filled has no gaps anyway.
- **Order and limit.** Gaps are ordered by row, then by column, and the first 20 are kept. The
  rest are counted.

### 3. Category gaps (`findCategoryGaps`)

The session's page nodes, excluding SERPs, are mapped through the lookup. Each of review, forum,
video, retailer and reference with no page is a gap `{ kind: "category", category }`. Every
category is phrased for display: "No reviews read yet", "No forum discussions read yet" and so
on.

### 4. Queries (`buildGapQuery`)

- **A cell.** `<entity name> <attribute>`.
- **A category.** `<subject> <word>`. The subject is the name of the table's first row (the
  entity with the most facts), or the session's title when there is none. The word is "review"
  for review, "forum" for forum, "video review" for video, "price" for retailer and
  "specifications" for reference.
- **Length.** A query is trimmed to 120 characters.

### 5. The engine and the URL

- **Which engine.** `chooseSearchEngine(serpUrls)` counts the session's SERP nodes per engine,
  matched by host through the engine table, and takes the most frequent, or DuckDuckGo when
  there are none.
- **The URL.** Each engine gains `searchUrl`, a template with `{query}`:
  - Google `https://www.google.com/search?q={query}`;
  - Bing `https://www.bing.com/search?q={query}`;
  - DuckDuckGo `https://duckduckgo.com/?q={query}`;
  - Startpage `https://www.startpage.com/sp/search?query={query}`;
  - Ecosia `https://www.ecosia.org/search?q={query}`;
  - Kagi `https://kagi.com/search?q={query}`;
  - Brave `https://search.brave.com/search?q={query}`.
- **Building it.** `buildSearchUrl(engine, query)` substitutes `encodeURIComponent(query)`.
- **A guard.** A constants guard checks that every template parses as an https URL and that its
  own results path and query parameter match the engine's `resultPaths` and `queryParameters`.
  So a gap's search is always captured as a SERP.

### 6. Opening it (`gaps.search { query }`)

The background:

1. reads the active session and its group;
2. builds the URL;
3. creates an active tab with it (`tabGroups.createTab`);
4. groups the tab into the session's group (`tabGroups.groupTabs`).

Capture then records the navigation as a SERP of the session, with the query. Without an active
session it answers a refusal, and the page shows why.

### 7. Reading and the page

- **`gaps.read { entityType? }`** builds the comparison table for the same type the page shows,
  then returns `{ cellGaps, moreCellGaps, categoryGaps }`. Each gap carries its display text and
  query.
- **The page.** `app/summariesApp` requests it beside `table.read`, and again when the type
  changes or columns are saved. `ResearchGaps` (`features/researchGaps/ui`) lists the gaps with
  "Search this", which sends `gaps.search`.

## Risks / Trade-offs

- **[A small category table]** Many hosts are other, so "No reviews read yet" can appear although
  a review site the table does not know was read. → The table is versioned and easy to extend.
  The gap only suggests a search; it does not assert anything.
- **[A noisy cell list]** → Only confirmed entities count, the list stops at 20, and only shown
  columns are checked. Removing a column the user does not care about removes its gaps.
- **[The engine guess]** → It follows what the user actually used in the session, and every
  engine is one of the bundled ones that capture already recognises.

## Migration Plan

Nothing to migrate: no new storage. Rollback removes the section.
