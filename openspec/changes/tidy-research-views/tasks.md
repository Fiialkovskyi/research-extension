# Tasks

## 1. Gaps that mean something

- [x] 1.1 `findCellGaps`: only rows with at least 3 facts from 2 pages (`MINIMUM_GAP_ROW_FACTS`), and group by row: one gap per entity naming up to 3 missing attributes and the count of the rest (the cap of 5 counts entities); `buildGapQuery` makes one query of the entity and those attributes; verify specs for each scenario of the requirements, and the "and N more" line.
- [x] 1.2 Update the gaps UI and the schema for grouped gaps (the gap carries the attribute count it left out), keeping "Search this" per gap; verify the component and `researchGapSchema` specs.

## 2. The kind of source from the page

- [x] 2.1 Read `@type` names and `og:type` in `readPageMetadata` (`readPageTypes` helper beside `findJsonLdProduct`, reusing its limits), add `schemaTypes` to `PageMetadata` (the `og:type` is already kept as `type`), `StoredPageMetadata` and the schemas, send them with the page's metadata and store them; verify helper and observer specs, including 12 types cut to 8, none declared, and nothing from text.
- [x] 2.2 `readSourceKind(metadata)` (shop, review, forum, video, unclassified) from the type names, with the mapping table in `constants.ts`; verify one spec for each row of the design's table and for no signal.
- [x] 2.3 `findCategoryGaps` from the session's page kinds: report a kind only with at least 3 pages that are not searches and at least half classified; read each node's metadata in `readResearchGaps`; delete `readDomainCategory`, `DOMAIN_CATEGORY_HOSTS`, `DOMAIN_CATEGORIES`, `DOMAIN_CATEGORIES_VERSION` and their specs and exports; verify the three scenarios of the requirement and that nothing imports them (`tsc`).

## 3. Sources named once, by site

- [x] 3.1 `shared/groupCitationsByPage` and `shared/readSourceLabel` (site name, else host without `www.`): group by URL in order of first appearance with the first quote and the count of more; verify specs.
- [x] 3.2 Use them in `ClusterSummaries` and `ProductCards`: the link text is the site label with the title as `title`; one line for each page; a statement's sources in `<details>` titled `Sources (N)`; "Wrong" per quote kept inside; update the summaries app and card specs, and the e2e specs that read citations if any.

## 4. Clusters follow the entity

- [x] 4.1 `readEntityLinks(database, sessionId)` in `researchClusters`' caller path (or its own module): pages by root entity with at least 3 facts, chained in recorded order; `clusterSession` takes `entityLinks` and adds edges of `ENTITY_EDGE_WEIGHT`; verify specs: two pages joined, 2-fact entity not, 40 pages give 39 edges, deterministic result.
- [x] 4.2 Name a cluster after its main entity (at least 3 facts) in `readClusterLabel` via an optional input, falling back as before; queue reclustering when entity resolution changes entities (`backgroundApp`); verify the label and the recluster trigger.

## 5. Docs and verification

- [x] 5.1 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md` (REQ-SYN-008/009 and clustering requirements, roadmap line) and run `openspec validate tidy-research-views`.
- [ ] 5.2 Run `npm run verify` and report faithfully. Manual check: reopen the "Iphone" session, read Gaps, Summaries (sources folded, site names, one line a page) and the cluster list; say what was not tried.
