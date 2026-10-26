# Proposal

## Why

The session about phones on one shop showed what the Summaries and Gaps views do with real data: a gap for every empty cell of every row, junk rows included; "no review", "no forum" because a bundled list of hosts knows a few dozen sites and nothing else; a "Wrong" link on every source line; the page's SEO title (`Купити Apple iPhone 17 256GB в Києві — ціна, відгуки | Яблуко`) as the link text; the same page listed again for each fact it gave; and clusters that follow how the user navigated, not what they looked at, so two pages about one phone can sit in two clusters. None of this is about one domain: the same would show for pens and bath mats. The fixes must hold in any language, with no host list.

## What Changes

- **Gaps are about what the user compares.** A cell gap is reported only for a row that is real — at least 3 facts from at least 2 pages — and only for the proposed columns. Gaps are grouped by entity: one line per product naming what is missing, with one search for it, instead of a line per cell.
- **A source's kind comes from the page.** The page observer also reads the `@type` names of the page's JSON-LD and Open Graph `og:type`; the kind of source (shop, review, forum, video) is read from them (a `Product` with an `Offer` is a shop, `Review`, `DiscussionForumPosting`, `VideoObject`), not from a bundled list of hosts. The list `domainCategories@1` is deleted. A page with no such signal is unclassified, and when most of the session's pages are unclassified, no source-kind gap is reported, since it cannot be told.
- **A source line names the site, once.** Citations show the page's site (its `og:site_name`, else its host) as the link text, with the page title on hover; a statement's or value's citations are one line for each page, however many of its facts it cites, with the number of quotes it gave. Sources of a statement are folded under "Sources (N)", and "Wrong" stays on each quote inside.
- **Clusters follow the product.** Pages that share a resolved entity are joined by an edge, like pages of similar content, so pages about one product tend to one cluster; a cluster is named after its entity with the most facts when it has one with at least 3, else as before.

## Capabilities

### New Capabilities

- `gap-signals`: which gaps are reported, how they are grouped, and how a source's kind is found.
- `source-lines`: how a source is named and listed in summaries and cards.

### Modified Capabilities

- `page-metadata`: adds the JSON-LD types and `og:type` to what is read and stored.
- `research-clusters`: adds links between pages that share an entity, and the cluster's name.

## Impact

- `pageMetadata` (reading and storing `schemaTypes`, `ogType`; `StoredPageMetadata`), `researchGaps` (reading, grouping, classification; `domainCategories@1` removed), `clusterSummaries` and `comparisonTable` UI and view builders (citation grouping), `researchClusters` (entity edges, cluster label), `backgroundApp` (reclustering after entity resolution passes the links).
- Storage: `StoredPageMetadata` gains optional fields, no migration. Pages captured before it have no kind and read as unclassified, until they are visited again.
- Gap text and summary markup change; no new permission or network behaviour.
- Depends on nothing open, but `add-research-gaps` is still an open change without a main spec, so the gap requirements here are in a capability of their own; reconcile the two when that change is archived.
