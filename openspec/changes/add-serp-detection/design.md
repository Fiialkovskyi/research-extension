# Design

## Context

- **Every recording path hard-codes `kind: "page"`.** Capture records nodes on four paths, each with its own `recordNode` call:
  - `recordNavigation`, for a commit;
  - `followTabMembership`, for a tab that joins the group or a restored tab;
  - `reconcileSessionTabs`, at start-up and when a group returns.
- **The storage types already have the fields.** `NodeKind = "serp" | "page"`, `StoredNode.query?` and `EdgeKind` `"refinement"` exist. Nothing writes them.
- **There is no root.** `StoredSession` has no `rootNodeId`; the v4 migration that would have added it was dropped from `add-graph-store`. Nodes are indexed by `sessionId` and by `[sessionId+tabId]`.
- **The map is kind-blind.**
  - The map snapshot (`mapNodeSchema`) does not carry `kind` or `query`.
  - The layout styles edges by `edge-${kind}` and dashes opener edges.
  - `MapPageNode` renders the title, domain and the closed label.
- **The e2e suite is offline.** Pages come from `e2e/fixtures/pageServer` on `127.0.0.1`, and the profile preferences come from `buildProfilePreferences`.

## Goals / Non-Goals

**Goals:**

- One function decides `kind`, `query` and `domain` for a URL, and every recording path uses it.
- The root and the refinement rule run inside the same capture step that records the SERP, so a push to the map never shows a SERP without its edge.
- An e2e scenario loads real search engine URLs offline.

**Non-Goals:**

- Recognising searches on sites outside the table (site search, Wikipedia, GitHub).
- Reading the query from the page or from form submissions.
- Showing the root differently from other SERPs on the map. It is the topmost node anyway.

## Decisions

### The engine table is configuration

`src/shared/config/searchEngines/` holds the bundled table, one row per engine:

- a hostname rule;
- the result path or paths;
- the query parameter names, in order of preference.

| Engine       | Hosts                                                              | Result path                | Query parameter |
| ------------ | ------------------------------------------------------------------ | -------------------------- | --------------- |
| Google       | `google.<tld>`, `www.google.<tld>` (including `co.uk` and similar) | `/search`                  | `q`             |
| Bing         | `bing.com`, `www.bing.com`                                         | `/search`                  | `q`             |
| DuckDuckGo   | `duckduckgo.com`, `html.duckduckgo.com`                            | `/`, `/html`, `/html/`     | `q`             |
| Startpage    | `startpage.com`, `www.startpage.com`                               | `/sp/search`, `/do/search` | `query`, `q`    |
| Ecosia       | `ecosia.org`, `www.ecosia.org`                                     | `/search`                  | `q`             |
| Kagi         | `kagi.com`                                                         | `/search`                  | `q`             |
| Brave Search | `search.brave.com`                                                 | `/search`                  | `q`             |

- **Matching ignores the scheme and the port.** It compares the hostname and the pathname only.
  - A results page is a results page over `http` too.
  - The e2e suite serves these hosts on a local port.
- **Why config rather than a feature constant?** The table is versioned product data, like `modelProfiles`. SEC-007's denylist will sit beside it, and the options page may list it later.
- **Alternative:** a regex per engine, as the target spec's "URL pattern table" suggests. Rejected because structured rows can be unit tested row by row and read better. The Google TLD rule is the only one that needs a pattern.

### `readSearchQuery(url)` and `buildPageFields(url)`

- **`tabCapture/model/readSearchQuery`** returns the trimmed query, or `undefined` when:
  - the URL matches no row;
  - the parameter is missing or blank.
- **`tabCapture/model/buildPageFields`** returns `{ kind, query?, domain }`. `query` is set only on a SERP. The four `recordNode` call sites spread its result instead of writing `kind: "page"` and `domain` themselves.
- **Alternative:** classify inside `researchGraph.recordNode`. Rejected because the graph feature stores what it is given. Classification is a capture rule, and keeping it in `tabCapture` keeps `researchGraph` free of search engine knowledge.

### The root is derived, not stored

- **`researchGraph/model/readSessionRoot(database, sessionId)`** returns the session's earliest SERP node by `createdAt`, or `undefined`.
  - It reads the session's nodes through the existing `sessionId` index and filters by kind.
  - A session holds hundreds of nodes at most (NFR budgets assume 300), so this is cheap.
- **Alternative:** a `StoredSession.rootNodeId` set when the first SERP is recorded. Rejected for this change because it adds a migration (v7) and a second write that has to stay consistent with the nodes. Two cases would need extra handling: deleting a node (STO-008) and importing a session (STO-007). If a later feature needs the root on every read, an index on `[sessionId+kind]` comes before a stored field.
- **The rule needs no lock.** Capture writes run one at a time on the background's work queue, so "earliest SERP" cannot change between reading the root and recording the edge.

### Refinement edges

`tabCapture/model/linkRefinement(database, node)` runs after a SERP node is recorded, on the same queued step.

- It reads the root.
- If the root is the node itself, it does nothing.
- If the normalized queries are equal, it does nothing. Normalizing lowercases the query and collapses runs of whitespace; `toLocaleLowerCase` is not used, so the result does not depend on the browser locale.
- Otherwise it records a `refinement` edge from the root to the node, with weight `CAPTURE_EDGE_WEIGHTS.refinement = 0.3`.

Two consequences:

- **Pagination.** A same-query page 2 is a SERP without a refinement edge, so clustering does not treat it as a sub-query.
- **Changed engines.** The same query on another engine counts as the same search. That is the intent: the user did not refine anything.

### Map

- **Snapshot.** `mapNodeSchema` gains `kind` (`picklist(["serp", "page"])`) and `query` (optional string), and `buildGraphSnapshot` copies them.
- **Layout.**
  - `buildMapLayout` puts `kind` and `query` into the node data.
  - Refinement edges get a dotted stroke (`strokeDasharray: "2 4"`) and the `edge-refinement` class.
  - Same-tab edges stay solid and opener edges stay dashed, so the three kinds differ in shape.
- **Layout ranks.** dagre already ranks by edges. A refinement edge places a later search below the root, which is what the spec asks for.
- **Node component.** `MapPageNode` shows a `search` label and the query as the main line for a SERP, with the domain below. A closed SERP keeps its `closed` label as well. The `data-node-kind` attribute exposes the kind to e2e.

### End-to-end: search hosts served locally

The suite must load `duckduckgo.com` and `bing.com` URLs without a network. Three profile preferences, added in `buildProfilePreferences` with a comment for each, make that possible:

- `network.dns.localDomains`, listing the engine hosts the spec uses. These resolve to the loopback address.
- `network.stricttransportsecurity.preloadlist: false`. Without it the HSTS preload list upgrades `http://duckduckgo.com` to `https`, and the local server speaks plain HTTP.
- `dom.security.https_first: false`, for the same reason.

The page server answers any request for a listed search host with a generated results page. That page links to `/a.html` on the loopback origin.

The scenario covers four things:

- search, then open a result in a new tab;
- search again with a narrower query in the session tab;
- on the map, two `search` nodes, a refinement edge and an opener edge;
- in the database, the kinds and queries.

- **Why not stub capture instead?** The point of e2e here is the real `webNavigation` commit for a search URL. A stub would test only what the unit specs already cover.

## Risks / Trade-offs

- **Search engines change their URLs.** → The table is one versioned module. A miss degrades to a plain `page` node, which is still correct, only less informative. Unit specs pin one real URL per engine.
- **Google's many country domains.** → The hostname rule accepts `google.` followed by a public-suffix-like TLD of one or two labels. Unusual country domains outside that shape are missed and become plain pages.
- **The profile preferences are Firefox internals.** → They live in `buildProfilePreferences`, beside the existing ones. If Firefox drops `network.dns.localDomains`, the e2e fails loudly at the first search load; it does not pass silently.
- **The root is the earliest SERP even after its tab closes.** → That is intended: the root is the question the session started from, not whatever is open now.
- **The derived root costs one index read per SERP.** → It is bounded by the session size, and it runs only for SERP nodes.

## Migration Plan

None. No schema change. Nodes recorded before this change keep `kind: "page"`; they are not reclassified.
