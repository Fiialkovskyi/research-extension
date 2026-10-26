# Design

## Context

Gaps (`researchGaps`): `findCellGaps` lists every empty cell of every row seen on two pages, `findCategoryGaps` the gap categories none of the session's page hosts is in (`DOMAIN_CATEGORY_HOSTS`, a bundled table). Summaries: `ClusterSummaries` and `ProductCards` list a citation per cited fact with `Wrong` on each line, titled by `pageTitle`. Clustering: Louvain over recorded edges plus semantic edges from page vectors; a cluster is labelled by its earliest search query or earliest page title. Entities are resolved after extraction, per session.

## Goals / Non-Goals

**Goals:** fewer, truer gaps; a source named by its site, once; clusters that group pages about one thing; all with no list of hosts, products or languages.

**Non-Goals:** the fact extractor, columns and cards (done); a new clustering algorithm; searching from gaps in more than one engine; a summary per product.

## Decisions

### 1. A cell gap needs a real row and a proposed column

`findCellGaps` takes the table as read, so its columns are the proposed ones. A row counts when it has at least `MINIMUM_GAP_ROW_FACTS` (3) facts from at least 2 pages (it was 2 pages only). A row below it is not a product the session knows, so it has no gaps. A fact count comes from the row's cells' sources.

### 2. One gap per entity

Gaps are grouped by row: `No weight, battery capacity for Pixel 10a` — at most 3 attributes named, the rest counted — with a single query `Pixel 10a weight battery capacity` (the entity and the first 3 attributes, trimmed as now). Search is about one thing at a time, so a line per entity is one useful search, and a table of 20 cells is a few lines. The cap of gap lines (`MAXIMUM_CELL_GAPS`) counts entities, and the rest are "and N more".

### 3. The kind of source from the page's own data

`readPageMetadata` already reads JSON-LD for `Product`. It also collects the `@type` names it finds (the page's own graph, flattened, at most 8, each at most 40 characters, from the scripts it already reads within its limits) and `og:type`, stored as `schemaTypes` and `ogType`. `readSourceKind(metadata)` maps them:

| Signal                                                                            | Kind         |
| --------------------------------------------------------------------------------- | ------------ |
| `Product` with an `offers` price, or `og:type` `product`/`og:product`             | shop         |
| `Review`, `Product` with a `review` of its own, `og:type` `article` with `Review` | review       |
| `DiscussionForumPosting`, `QAPage`, `Question`                                    | forum        |
| `VideoObject`, `og:type` `video.*`                                                | video        |
| anything else, or no signal                                                       | unclassified |

The map is a list of schema.org type names, which are a public vocabulary and not about any language, product or host; hosts and brand names are not in it. `reference` and `news` are not asked for: a comparison does not lack them.

A kind is stored with the node's metadata at read time, not computed from hosts. `findCategoryGaps` reports a kind missing only when at least half of the session's pages (not search results) are classified, and a session of fewer than 3 pages reports none: with most pages unclassified the kinds cannot be told. This is the price of dropping the host list, and the design accepts it: a false "no forum" is worse than none.

`readDomainCategory`, `DOMAIN_CATEGORY_HOSTS` and `DOMAIN_CATEGORIES_VERSION` are removed. Pages captured before this change have no signal and are unclassified; revisiting them reads it.

### 4. A source line is a page

`groupCitationsByPage(citations)` groups a statement's or value's citations by page URL, keeping the first quote and the count of the rest, in order of first appearance. The line's link text is the site name, else the page's host without `www.`, and the title is its `title` attribute; the day follows as now. Each quote keeps its own `Wrong` — a fact is what is wrong — but a statement's sources are folded in a `<details>` titled `Sources (N)`, like a card's, so the page shows the statement and one control. The grouping is shared by the summary and the card, so it lives in `shared`.

### 5. Pages that share an entity are one cluster

`clusterSession` takes an optional `entityLinks: { nodeId, entityId }[]`, built by `readEntityLinks` from the session's facts' root entities with at least 3 facts, and adds an edge of weight `ENTITY_EDGE_WEIGHT` (1.0, the weight of a recorded link) between each pair of pages sharing one, like the semantic edges and with the same bounds (at most `MAXIMUM_ENTITY_EDGES` pairs for each entity, by a chain of consecutive pages rather than all pairs, so an entity on 40 pages adds 39 edges, not 780). Reclustering is queued when entity resolution finishes. The cluster's label is the root entity with the most facts among its pages, when it has at least 3, else as before. No product name or type is looked at: an entity is whatever resolution made.

## Risks / Trade-offs

- **Fewer kinds are classified.** Many pages have no JSON-LD; the rule that most pages must be classified keeps the view quiet instead of wrong. Shops and videos mostly carry markup; forums and blogs vary.
- **Entity edges can merge clusters.** A wrongly merged entity pulls pages together; the weight is that of a recorded link, not more, and the user's own navigation edges still count.
- **Reclustering costs.** One more recluster after entity resolution per session, which the 5 s quiet period already batches.
- **Folding hides sources.** The first view shows no quote; "Sources (N)" says how many there are, and a card already works this way.

## Migration Plan

Nothing runs on upgrade. Metadata and clusters are filled as pages are visited and the session is reclustered; gap and source markup change at once.

## Open Questions

- Should a gap line be searchable for one missing attribute too? Left out: one search per entity is what a user does.
- Do forums and blogs need a signal beyond `@type`? Left for a later change, once the unclassified share is known from real sessions.
