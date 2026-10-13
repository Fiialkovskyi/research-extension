# Tasks

## 1. Search URLs

- [x] 1.1 Add `searchUrl` to `SearchEngine` and to every bundled engine (design decision 5), with a guard `constants.spec.ts`: each template is an https URL whose path is one of the engine's `resultPaths` and which carries `{query}` in one of its `queryParameters`. Verify that the guard passes, and that it fails for a template with the wrong path.

## 2. Gaps (pure parts)

- [x] 2.1 Create `features/researchGaps` with the `domainCategories@1` table and `readDomainCategory`. Verify with specs for exact hosts, `www.`, suffixes and `amazon.*`, Wikipedia in any language, the forum patterns, and unknown hosts.
- [x] 2.2 Add `findCellGaps` (design decision 2). Verify with specs for:
  - a confirmed row's empty cell;
  - a row from one page left out;
  - the 20-gap limit and the count of the rest.
- [x] 2.3 Add `findCategoryGaps` (design decision 3). Verify with specs for: only shops visited, every category visited, SERPs ignored, and other filling nothing.
- [x] 2.4 Add `buildGapQuery`, `chooseSearchEngine` and `buildSearchUrl` (decisions 4 and 5). Verify with specs for:
  - cell and category queries;
  - the subject falling back to the title;
  - trimming;
  - the most-used engine;
  - DuckDuckGo with no searches;
  - encoding.

## 3. Background

- [x] 3.1 Add `readResearchGaps` and wire `gaps.read` and `gaps.search` into `app/backgroundApp`. Verify with background specs:
  - gaps read from a session with facts;
  - a search opening an active tab grouped into the session's group, at the expected URL;
  - a refusal without an active session.

## 4. Page

- [x] 4.1 Add the `ResearchGaps` component, and render it in `app/summariesApp` below the table, re-reading with the table's type. Verify with component and app specs for: the cell and category gaps, "N more", "Search this" sending the query, and nothing missing.
- [x] 4.2 Extend `summaries.e2e.ts`: a new session shows the category gaps, and "Search this" on one opens a results-page tab in the session's group. The suite's page server speaks only HTTP, so the https results page does not load there. That capture records it as a search follows from the engine-template guard (1.1), which checks every template against the hosts, paths and parameters capture recognises. Verify that the e2e passes.

## 5. Documentation and verification

- [x] 5.1 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`: tick "Gaps and open questions with 'search this'" as partly done, with model-proposed questions still open; record `domainCategories@1`, the confirmation rule and the engine choice. Verify that `openspec validate add-research-gaps --strict` passes.
- [x] 5.2 Run `npm run verify` and confirm that it passes.
