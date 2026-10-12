# Tasks

## 1. Search engine table and query extraction

- [x] 1.1 Add `src/shared/config/searchEngines/` with the bundled table from design.md and export it from the config barrel; verify `npm run typecheck` passes.
- [x] 1.2 Add `tabCapture/model/readSearchQuery` with a spec covering:
  - one real results URL per engine;
  - a Google country domain (`google.co.uk`);
  - matching that ignores scheme and port;
  - a blank or missing query, an engine home page and a non-engine host, each giving `undefined`;
  - Startpage's `query` parameter.
- [x] 1.3 Add `tabCapture/model/buildPageFields` with a spec: it returns `{ kind: "serp", query, domain }` for a results URL and `{ kind: "page", domain }` with no `query` key otherwise.

## 2. SERP nodes, root and refinement edges

- [x] 2.1 Add `researchGraph/model/readSessionRoot` with a spec: it returns the earliest SERP by `createdAt`, ignores `page` nodes and other sessions' nodes, and gives `undefined` with no SERP.
- [x] 2.2 Add `refinement: 0.3` to `CAPTURE_EDGE_WEIGHTS`. Add `tabCapture/model/linkRefinement` with a spec:
  - an edge from the root with weight 0.3 for a different query;
  - none for the root itself;
  - none for the same query differing only in case or whitespace;
  - none when no root exists yet.
- [x] 2.3 Make `recordNavigation`, `followTabMembership` and `reconcileSessionTabs` use `buildPageFields` and call `linkRefinement` after recording a SERP. Extend each spec with a SERP case, and verify that `npm run test` passes.
- [x] 2.4 Extend `app/backgroundApp/index.spec.ts`: two searches committed back to back produce one refinement edge, and a map push after them already holds it.

## 3. Map

- [x] 3.1 Add `kind` and `query` to `mapNodeSchema` and to `buildGraphSnapshot`; update its spec.
- [x] 3.2 `buildMapLayout`: pass `kind` and `query` in the node data, and give refinement edges the `edge-refinement` class and a dotted stroke. Its spec checks that the three edge kinds differ in shape and that a refined search is ranked below the root.
- [x] 3.3 `MapPageNode`: for a SERP, show the `search` label, the query and the domain, and set `data-node-kind`. Its spec covers an open SERP, a closed SERP (both labels shown) and a plain page.

## 4. End-to-end

- [x] 4.1 Add `network.dns.localDomains` (the engine hosts the scenario uses), `network.stricttransportsecurity.preloadlist: false` and `dom.security.https_first: false` to `buildProfilePreferences`, each with a comment saying why; update its spec.
- [x] 4.2 Page server: answer a request for a listed search host with a generated results page that links to `/a.html` on the loopback origin. The page builder is unit tested.
- [x] 4.3 Extend the map fixture's reader with `kind` and the shown query, and the database snapshot with `kind` and `query`; update their parser specs.
- [x] 4.4 Add `e2e/specs/searchCapture.e2e.ts`:
  - start a session and search DuckDuckGo for `e-bike motors`;
  - open the result in a new tab;
  - search Bing for `e-bike mid-drive motors` in the session tab;
  - check the database (kinds, queries, one refinement edge from the first SERP);
  - check the map (two `search` nodes with their queries, refinement and opener edges, the second search below the first).

  Verify with `npx wdio run e2e/wdio.conf.ts --spec e2e/specs/searchCapture.e2e.ts`.

## 5. Docs and integration

- [x] 5.1 Note in `RESEARCH_GRAPH_EXTENSION_SPEC.md` next to REQ-CAP-003:
  - the root is derived from the graph, not stored;
  - a same-query SERP gets no refinement edge.
- [x] 5.2 Run `npm run verify` and `openspec validate add-serp-detection`. Both must pass.
