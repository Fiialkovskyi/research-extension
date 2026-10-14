# Research Graph Extension Spec

Oct 3, 2026 · @Hello, can you read an article by URL and summarize it?

Technical specification for a Firefox extension (Linux, macOS) that implements the Research Graph Browser PRD with local Hugging Face models only.

## 1. Overview & conventions

The extension is a Firefox MV3 add-on with a background event page, content scripts, a sidebar, and pluggable local inference providers. Every derived artifact carries provenance, so models can be swapped without silently mixing incompatible outputs.

**Scope**

- **Platforms:** Firefox desktop on Linux (x86\_64, aarch64) and macOS (Apple Silicon and Intel). Minimum version: Firefox ESR 140 (`strict_min_version: "140.0"`), so Linux distributions that ship ESR are covered.
- **Out of scope:** Windows, Android, Chromium browsers, and any cloud inference (PRD non-goals). Code should avoid gratuitous Firefox-only APIs where a standard one exists, but cross-browser support is not a requirement.
- **Source PRD:** Research Graph Browser PRD (Stories 1 to 7, privacy section, explicit session start).

**Conventions**

- Requirements use IDs `REQ-<AREA>-<NNN>` and EARS phrasing ("WHEN \<trigger>, the system SHALL \<response>"). SHALL = mandatory, SHOULD = expected unless justified, MAY = optional.
- Each requirement is testable; acceptance tests reference the requirement ID.
- Interfaces are TypeScript. Persisted schemas are versioned (`schema_version`) and validated at every boundary with runtime schemas (zod or valibot).
- "Perimeter" means the user's computer. "Egress" means any network request not initiated by the user's own browsing.

**Traceability**

| PRD item                          | Spec areas                       |
| --------------------------------- | -------------------------------- |
| Story 1: graph capture            | CAP (section 4)                  |
| Story 2: computed clusters        | CLU (section 5), MOD (section 6) |
| Story 3: engagement and frontier  | CAP, UI (section 11)             |
| Story 4: cluster synthesis        | SYN (section 8), LIN (section 7) |
| Story 5: generic comparison table | SYN, LIN                         |
| Story 6: gaps and open questions  | SYN                              |
| Story 7: save and resume          | STO (section 9)                  |
| Privacy and local processing      | SEC (section 10), RT (section 3) |
| Explicit session start            | RT, CAP                          |

## 2. Architecture

The background event page is the single writer and coordinator. Every other context talks to it over typed RPC, and the only outside parties are an optional local native host and Hugging Face for model files.

&#91;embedded content: extension architecture · 5 contexts in the extension origin, 2 external parties\]

Inference runs off the background's main thread: in-extension models in a dedicated Worker, larger models in the native host. Both sit behind the same provider interface (section 6).

**Key architectural decisions**

| Decision           | Choice                                                                | Rationale                                                                                                                             |
| ------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Background type    | MV3 event page (`background.scripts`)                                 | Firefox runs MV3 backgrounds as event pages and does not run `background.service_worker`; event pages also keep DOM and Worker access |
| Single writer      | Only the background writes IndexedDB                                  | Avoids cross-context transaction races; UI stays a pure view                                                                          |
| State              | IndexedDB as the source of truth; in-memory state is a cache only     | Survives event-page unloads and browser restarts                                                                                      |
| Inference hosting  | Dedicated Worker plus optional native host behind `InferenceProvider` | Keeps the UI and event handling responsive; lets Linux users get larger models without WebGPU                                         |
| Vector search      | Brute-force cosine over `Float32Array` per space                      | Sessions hold thousands of chunks at most; no vector database dependency                                                              |
| Clustering library | graphology plus Louvain, warm-started                                 | Maintained, pure JS, deterministic with a seed                                                                                        |
| Model coupling     | Family contracts plus pinned manifests                                | Models are swappable; lineage is explicit                                                                                             |
| Content scripts    | Registered dynamically only during active sessions                    | Matches explicit-start privacy requirement and reduces page overhead                                                                  |

The Firefox background behavior follows [Mozilla's MV3 notes](https://blog.mozilla.org/addons/2022/05/18/manifest-v3-in-firefox-recap-next-steps/) and current [framework documentation](https://extension.js.org/docs/implementation-guide/background); spike M0-1 (`spike-event-page-lifetime`) measured lifetime behavior on Firefox 157 release: a pending `fetch`, a timer or IndexedDB writes do not keep an idle event page loaded, an extension API call every few seconds does, and Firefox reads the idle timeout when the page starts.

## 3. Extension runtime (RT)

The background is an MV3 event page, not a service worker. Firefox runs MV3 backgrounds from `background.scripts` and keeps DOM APIs and Web Workers there. All state lives in IndexedDB, so the event page can be unloaded at any time without data loss.

**Manifest (normative excerpt)**

```json
{
  "manifest_version": 3,
  "browser_specific_settings": {
    "gecko": { "id": "research-graph@example.org", "strict_min_version": "140.0" }
  },
  "background": { "scripts": ["background.js"], "type": "module" },
  "sidebar_action": { "default_panel": "sidebar.html", "open_at_install": false },
  "action": { "default_title": "Start research" },
  "permissions": [
    "tabs",
    "webNavigation",
    "storage",
    "unlimitedStorage",
    "scripting",
    "idle",
    "alarms"
  ],
  "optional_permissions": ["nativeMessaging"],
  "optional_host_permissions": ["<all_urls>"],
  "host_permissions": ["https://huggingface.co/*", "https://*.hf.co/*"],
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; connect-src 'self' https://huggingface.co https://*.hf.co http://127.0.0.1:11434"
  }
}
```

The exact Hugging Face download hosts (LFS and CDN redirects) SHALL be enumerated and verified in spike M0-3. The CSP `connect-src` is the enforcement point for the no-egress guarantee (REQ-SEC-001).

**Execution contexts**

| Context                                                      | Responsibility                                                                        | Must not                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Background event page                                        | Session lifecycle, tab and navigation listeners, graph writes, job scheduler, RPC hub | Hold state only in memory; run inference on its main thread            |
| Inference worker (dedicated Worker from the background page) | Runs in-extension models (Transformers.js / ONNX Runtime Web)                         | Touch browser APIs; persist anything except through RPC                |
| Content script (dynamically registered)                      | Scroll depth, visibility, copy events, readable-text extraction                       | Make network requests; store page text itself; run on denylisted sites |
| Sidebar (`sidebar_action`)                                   | Research tree, unread queue, synthesis panel                                          | Write to IndexedDB directly; it goes through background RPC            |
| Map page (`map.html`, extension tab)                         | Research map graph view                                                               | Same as sidebar                                                        |
| Options page                                                 | Model management, privacy settings, denylist, data deletion                           |                                                                        |
| Native host (optional, separate process)                     | Larger models via Python or llama.cpp                                                 | Open network sockets (REQ-SEC-004)                                     |

**Requirements**

- **REQ-RT-001:** The extension SHALL NOT inject content scripts or record telemetry until the user explicitly starts a session. A session is started by naming it in the popup, which creates a Firefox tab group with that title. Until after the MVP, at most one session SHALL be active: starting one while another is active SHALL be refused.
- **REQ-RT-002:** WHEN the first session is started, the system SHALL request `<all_urls>` host permission from that user gesture; IF denied, the system SHALL run in degraded mode (tab-tree and navigation signals only, no scroll, copy or content).
- **REQ-RT-003:** The content script SHALL run only in the top frame of the active session's tabs. It is injected with `scripting.executeScript` into each session tab when capture records its page, when a tab joins the group, at reconciliation and when page access is granted, and stops observing when its tab leaves the session. It is not registered for every page with `scripting.registerContentScripts`: pages outside the session's group are then never observed at all (OpenSpec change `add-engagement-signals`).
- **REQ-RT-004:** The background SHALL be restart-safe. Every listener is registered synchronously at top level, and in-memory caches are rebuilt lazily from IndexedDB.
- **REQ-RT-005:** Long work SHALL run as checkpointed, idempotent jobs (section 9). IF the event page unloads mid-job, the job SHALL resume from its last checkpoint on the next wake.
- **REQ-RT-006:** No remote code. All JavaScript and WASM (including ONNX Runtime binaries) SHALL ship in the package. Models are data files, downloaded and hash-verified.
- **REQ-RT-007:** The extension SHALL pass `web-ext lint` with zero errors and be submittable to AMO with reproducible source build instructions.

**Messaging contract**

All contexts talk to the background through a typed RPC layer over `runtime.Port` (long-lived) or `runtime.sendMessage` (one-shot). Each message has `{v: 1, type, id, payload}` and is schema-validated on receipt; unknown types are rejected.

| Message                                                      | From → to                          | Purpose                                                                                  |
| ------------------------------------------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `signal.batch`                                               | content → background               | Batched scroll, visibility and copy events (flushed at most every 2 s and on `pagehide`) |
| `content.extracted`                                          | content → background               | Readable text and content hash for a deep-read page                                      |
| `graph.subscribe` / `graph.patch`                            | UI ↔ background                    | Initial snapshot, then incremental patches                                               |
| `session.start` / `.pause` / `.save` / `.resume` / `.delete` | UI → background                    | Session lifecycle                                                                        |
| `node.update` / `cluster.edit`                               | UI → background                    | User corrections (move, merge, split, rename, pin)                                       |
| `infer.request` / `infer.result` / `infer.progress`          | background ↔ worker or native host | Inference RPC (section 6)                                                                |
| `model.install` / `model.activate` / `model.remove`          | options → background               | Model management                                                                         |

## 4. Telemetry capture & graph model (CAP)

The graph is built from browser events (tabs, navigation) plus throttled in-page signals. Page text is extracted only for pages that cross the deep-read threshold, and never for denylisted sites.

**Event sources**

| Signal                | Source API                                                                                                | Notes                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opener relationship   | `tabs.onCreated` (`openerTabId`), `webNavigation.onCreatedNavigationTarget` (`sourceTabId`)               | Primary structural edge                                                                                                                                                       |
| Transition type       | `webNavigation.onCommitted` (`transitionType`, `transitionQualifiers`)                                    | link, typed, form\_submit, reload, auto\_bookmark and others                                                                                                                  |
| SERP detection        | URL pattern table for supported search engines (Google, Bing, DuckDuckGo, Startpage, Ecosia, Kagi, Brave) | Extracts the query from URL parameters only                                                                                                                                   |
| Focus and active time | `tabs.onActivated`, `windows.onFocusChanged`, `idle.onStateChanged` (60 s threshold), `visibilitychange`  | Active dwell counts only while the tab is focused, the window is focused, and the user is not idle                                                                            |
| Scroll depth          | Content script, passive `scroll` listener, `requestAnimationFrame` throttled                              | Max of `(scrollY + innerHeight) / scrollHeight`                                                                                                                               |
| Copy and paste events | Content script `copy` and `paste` listeners (trusted events only)                                         | Count per node, and each event logged with its page and the time its batch arrived (OpenSpec change `add-map-views`); the clipboard, selection and pasted text are never read |
| Activity log          | Every counted interval of active time                                                                     | Page, start and end, so the map can draw the session as a timeline; times and pages only                                                                                      |
| Tab close             | `tabs.onRemoved`                                                                                          | Node keeps its history and becomes `closed`                                                                                                                                   |

**Requirements**

- **REQ-CAP-001:** WHEN a session is active and a tab is created with an opener inside the session, the system SHALL create a node with `opener_node_id` set and add it to that session within 1 s.
- **REQ-CAP-002:** WHEN a navigation commits in a session tab, the system SHALL create a new node (`parent_node_id` = previous node in that tab) unless the transition is `reload` or a same-document fragment change.
- **REQ-CAP-003:** WHEN a committed URL matches a SERP pattern, the node SHALL have `kind = "serp"` and `query`. The first SERP in a session SHALL become the root; later SERPs SHALL be linked to the root by a `refinement` edge. The root is derived from the graph (the session's earliest SERP), not stored on the session. A later SERP whose query equals the root's, ignoring case and whitespace, is a further page of the same search and gets no refinement edge (OpenSpec change `add-serp-detection`).
- **REQ-CAP-004:** A tab SHALL belong to the active session if and only if it is in the session's tab group. Tabs that join the group, including those Firefox adds because they were opened from a grouped tab, SHALL be captured from the moment they join. Tabs that leave the group SHALL stop being captured but keep their recorded history. Tabs outside the group SHALL NOT be captured.
- **REQ-CAP-005:** Content scripts SHALL batch signals and flush them at most every 2 s, on `visibilitychange` to hidden, and on `pagehide`. Added main-thread cost SHALL stay under 1 ms per event, measured at p95.
- **REQ-CAP-006:** WHEN a page node first reaches deep read (see engagement states) while its page is open, the content script SHALL extract readable text with Mozilla Readability and send it to the background. Text over 200 KB SHALL be truncated and flagged. The background computes the SHA-256 `content_hash`: `crypto.subtle` is missing on plain-`http` pages, and the hash is the background's to vouch for (OpenSpec change `add-engagement-signals`).
- **REQ-CAP-007:** Co-attention edges SHALL be created WHEN focus alternates between the same two nodes at least 3 times within 5 minutes. A move counts when focus goes from one session node to another, in either direction; losing window focus or going idle is not a move. The edge is recorded once per pair, from the smaller node id to the larger, with weight 0.8, and the map draws it without an arrow and leaves it out of the layout (OpenSpec change `add-co-attention-edges`).
- **REQ-CAP-008:** Private-browsing windows, `about:` and `moz-extension:` pages, and denylisted domains SHALL never produce nodes. A session tab that navigates to a denylisted page closes the node it was showing, and the next recorded page in that tab has no parent (OpenSpec change `add-capture-denylist`).
- **REQ-CAP-010:** A node's active dwell SHALL count the time its tab is the selected tab of the focused browser window while the user is not idle (60 s without input), measured in the background from `tabs.onActivated`, `windows.onFocusChanged` and `idle.onStateChanged`, so it works without page access. Idle time SHALL end when input stopped, not when idleness was reported. One uninterrupted stretch SHALL count at most 10 minutes, and time SHALL NOT be lost when the event page unloads. A return to a node that already had dwell SHALL count as a revisit once it lasts 20 s (OpenSpec change `add-engagement-signals`).
- **REQ-CAP-009:** WHEN the session's tab group is removed, by any path, the session SHALL be closed rather than ended, because Firefox reports a deleted, saved or emptied group the same way and restores several of them under the same id. A group coming back under that id, or a session tab restored after its group is gone, SHALL make the session active again. Starting a new session SHALL end a closed one and keep it as saved, not deleted. WHEN the group is renamed, the session's title SHALL follow it. The session SHALL record its group's id, which is stable across a browser restart, and SHALL be reconciled with the browser at start-up.

**Engagement states (rule-based, versioned as `engagement_rules@2`)**

A quick return is a first visit to a page reached from a SERP that ends, before 10 s of active dwell, with focus on a SERP: going back in the same tab or switching to the search's tab. It is counted as the node signal `quick_return_count`. A page is a dead end by dwell and scroll only once it is no longer focused; a quick return makes it one at once (OpenSpec change `add-co-attention-edges`).

| State       | Rule (all thresholds configurable)                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `unread`    | Never focused                                                                                                                    |
| `dead_end`  | Active dwell under 8 s and scroll depth under 15%, or a return to the SERP within 10 s                                           |
| `skimmed`   | Not dead end, and not yet deep read                                                                                              |
| `deep_read` | Active dwell of at least 45 s and scroll depth of at least 40%, or any copy event, or at least 2 revisits with 20 s or more each |

**Core types**

```ts
type NodeKind = "serp" | "page";
type EdgeKind = "opener" | "same_tab" | "refinement" | "co_attention" | "return" | "user";

interface Session {
  id: SessionId;
  schema_version: 1;
  title: string;
  group_id: number; // the Firefox tab group the session is
  root_node_id: NodeId | null;
  status: "active" | "paused" | "saved";
  created_at: number;
  updated_at: number;
  active_embedding_space_id: SpaceId | null; // section 7
  last_position?: { node_id: NodeId; scroll: number };
}

interface GraphNode {
  id: NodeId;
  session_id: SessionId;
  tab_id: number; // the tab that showed it; with tab_state, how a woken background finds a tab's node
  kind: NodeKind;
  url: string;
  url_pattern: string;
  domain: string;
  domain_category: DomainCategory;
  title: string;
  query?: string;
  parent_node_id: NodeId | null;
  opener_node_id: NodeId | null;
  transition_type: string;
  signals: {
    active_dwell_ms: number;
    max_scroll: number;
    copy_events: number;
    focus_count: number;
    revisit_count: number;
    children_count: number;
  };
  engagement: "unread" | "skimmed" | "deep_read" | "dead_end";
  tab_state: "open" | "closed" | "never_focused"; // a node closes when its tab closes, leaves the group, or navigates on
  content_hash?: string;
  snapshot_id?: SnapshotId;
  cluster_id?: ClusterId;
  user_pinned: boolean;
  created_at: number;
  last_focused_at?: number;
}

interface GraphEdge {
  id: EdgeId;
  session_id: SessionId;
  kind: EdgeKind;
  from: NodeId;
  to: NodeId;
  weight: number;
  created_at: number;
}
```

`domain_category` comes from a bundled, versioned lookup table (manufacturer, retailer, review, forum, video, news, reference, other). It does not require any model.

## 5. Clustering (CLU)

Clusters come from community detection on one weighted graph that fuses structural, behavioral and (when available) semantic edges. They are recomputed incrementally, with identity matching and hysteresis so they stay stable on screen.

**Edge weights (`cluster_config@1`, tunable)**

| Edge source                                                                 | Default weight                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Opener edge                                                                 | 1.0                                                                      |
| Refinement edge (SERP to SERP)                                              | 0.3. Sub-queries should seed separate clusters, not merge with the root. |
| Same-tab navigation                                                         | 0.5                                                                      |
| Co-attention                                                                | 0.8                                                                      |
| Same domain and URL path prefix                                             | 0.4                                                                      |
| Opened within the same 60 s burst from the same parent                      | 0.3                                                                      |
| Semantic: cosine similarity of node embeddings at or above τ (default 0.55) | 1.2 × (sim − τ) / (1 − τ)                                                |
| User edge (manual move or merge)                                            | Hard constraint, not a weight                                            |

**Algorithm**

1. Build the fused graph over page and SERP nodes in the session. Exclude `dead_end` nodes from detection; attach them afterwards to their parent's cluster.
2. Run Louvain community detection (graphology implementation) warm-started from the previous partition, with a fixed seed. Leiden MAY replace Louvain if a maintained JS implementation passes the stability tests.
3. Apply constraints: pinned nodes keep their cluster; user merges and splits are enforced as must-link and cannot-link pairs.
4. Match new communities to existing cluster IDs by maximum Jaccard overlap (Hungarian assignment); unmatched communities get new IDs.
5. Hysteresis: a node changes cluster only IF its affinity to the new cluster exceeds its affinity to the current one by at least 25% for 2 consecutive recomputes.
6. Label each cluster: the seeding sub-query if any, otherwise an LLM-generated 2 to 4 word label from member titles (section 8), otherwise the dominant domain plus category.

**Implemented so far (OpenSpec change `add-structural-clustering`).** Steps 1, 2, 4 and 6 run without any model, as `louvain@1` with `cluster_config@1`. Details:

- **Edges.** The recorded edges are used: opener, same-tab, refinement and co-attention. Since OpenSpec change `add-semantic-cluster-edges`, semantic edges join pages whose normalised mean chunk vectors in the session's embedding space have cosine ≥ 0.55, weighted 1.2 × (sim − τ) / (1 − τ), and the clustering records that space. They connect what structure leaves apart and strengthen clusters; they do not override a strong structural split. The derived same-domain and same-burst edges are not added yet.
- **Warm start.** graphology's Louvain cannot warm-start from a previous partition, so step 2 runs from scratch with a fixed seed (mulberry32). Step 4 keeps cluster ids by greedy best overlap rather than Hungarian assignment.
- **Labels.** Step 6 uses the earliest search's query, or else the earliest page's title.
- **Not yet built:** steps 3 and 5 (constraints and hysteresis), and the stability test (REQ-CLU-005).
- **Storage.** Results are stored whole per session in a `clusterings` store.
- **Display.** The popup's research tree groups pages by cluster once there are two or more.

**Requirements**

- **REQ-CLU-001:** Clustering SHALL work with no models installed, using structural and behavioral edges only.
- **REQ-CLU-002:** WHEN semantic edges are used, all vectors in one computation SHALL belong to the session's `active_embedding_space_id` (REQ-LIN-002). Nodes without a vector in that space SHALL contribute no semantic edges.
- **REQ-CLU-003:** Recompute SHALL be triggered by graph changes, debounced to 5 s, and SHALL finish in under 200 ms for 300 nodes (p95, M1 MacBook Air class, Firefox release).
- **REQ-CLU-004:** User corrections SHALL never be overridden by automatic recompute.
- **REQ-CLU-005:** Under replay of a recorded session, no more than 10% of nodes SHALL change cluster after their first 3 minutes of membership (stability test, section 13).
- **REQ-CLU-006:** Every cluster SHALL store `algorithm_version`, `config_version` and, IF semantic edges were used, `embedding_space_id` (section 7).

## 6. Model abstraction layer (MOD)

Application code depends on model _families_, never on a specific model. A model is a Hugging Face repo pinned to a commit, described by a manifest, verified by a conformance suite, and run by one of several local providers.

**Families and their contracts**

| Family                            | Used for                                                    | Contract the model must declare                                                                                             |
| --------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `embedding`                       | Semantic edges, entity resolution, near-duplicate detection | Output dims, max input tokens, pooling, normalization, similarity metric, query/document prefixes, optional Matryoshka dims |
| `text-generation`                 | Fact extraction, summaries, labels, open questions          | Context window, chat template, structured-output support (JSON schema or grammar), max new tokens                           |
| `reranker` (optional)             | Choosing the most relevant chunks for a summary             | Max pair length, score range                                                                                                |
| `token-classification` (optional) | Cheap entity detection before LLM extraction                | Label set                                                                                                                   |

**Interfaces**

```ts
interface ModelRef {
  hub: "huggingface";
  repo: string;
  revision: string /* 40-char commit SHA, required */;
}

interface ModelManifest {
  ref: ModelRef;
  family: Family;
  format: "onnx" | "gguf" | "safetensors";
  quantization?: string; // e.g. "q8", "q4f16", "Q4_K_M"
  files: { path: string; sha256: string; bytes: number }[];
  license: string; // SPDX id from the model card
  providers: ProviderKind[]; // which runtimes can load it
  contract: EmbeddingContract | TextGenContract | RerankerContract | TokenClsContract;
  manifest_version: 1;
}

interface EmbeddingContract {
  dims: number;
  max_input_tokens: number;
  pooling: "mean" | "cls" | "last_token";
  normalize: boolean;
  similarity: "cosine" | "dot";
  prefixes: { query: string; document: string }; // "" when the model needs none
  matryoshka_dims?: number[];
}

interface EmbeddingModel {
  readonly manifest: ModelManifest;
  readonly space: EmbeddingSpace; // section 7
  embed(texts: string[], role: "query" | "document"): Promise<Vector<SpaceId>[]>;
  countTokens(text: string): Promise<number>;
}

interface TextGenContract {
  context_window: number;
  max_new_tokens: number;
  chat_template: "from_tokenizer_config" | string;
  structured_output: "json_schema" | "grammar" | "none";
}

interface TextGenModel {
  readonly manifest: ModelManifest;
  generate(req: {
    messages: ChatMessage[];
    max_tokens: number;
    temperature: number;
    seed?: number;
    json_schema?: JSONSchema;
    signal?: AbortSignal;
  }): AsyncIterable<{ delta: string }> & { final(): Promise<GenResult> };
  countTokens(text: string): Promise<number>;
}
```

**Providers**

All providers implement one `InferenceProvider` interface (`listCapabilities`, `load(manifest)`, `unload`, `run(request)`), so the scheduler never knows which runtime it is calling.

| Provider                    | Runtime                                                                                                             | Default use                                                                   | Notes                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ext-ort` (default)         | Transformers.js v4 with ONNX Runtime Web in a dedicated Worker; WebGPU when available, WASM otherwise               | Embedding models; small text-generation models (around 1B parameters or less) | ONNX models only. WebGPU is on by default in Firefox for Apple Silicon Macs; on Linux it is not yet on in stable releases, so plan for WASM there. |
| `native` (optional)         | Native messaging host: Python with Hugging Face `transformers` and `sentence-transformers`, or `llama.cpp` for GGUF | Text-generation models of 3B to 8B parameters, and faster embeddings          | Recommended on Linux for synthesis quality. Installed separately; see SEC requirements.                                                            |
| `firefox-ml` (experimental) | Firefox AI runtime via `browser.trial.ml` (`trialML` optional permission)                                           | Not a v1 dependency                                                           | Behind flags on release Firefox and documented as subject to change. Track it; adopt only if it stabilizes and supports pinned revisions.          |

The Firefox WebGPU status and `trial.ml` details come from the [gpuweb implementation status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status), [Mozilla's announcement](https://blog.mozilla.org/en/firefox/firefox-ai/running-inference-in-web-extensions/) and the [Firefox source docs](https://firefox-source-docs.mozilla.org/toolkit/components/ml/extensions.html).

**Requirements**

- **REQ-MOD-001:** Feature code SHALL obtain models only through `ModelRegistry.getActive(family, purpose)`. Importing a provider or model directly from feature code SHALL fail the lint rule `no-direct-model-import`.
- **REQ-MOD-002:** Every installed model SHALL be pinned to a commit SHA. Branch names such as `main` SHALL be resolved to a SHA at install time and never re-resolved silently.
- **REQ-MOD-003:** Every downloaded file SHALL be verified against the manifest SHA-256 before first load; a mismatch SHALL abort the install and delete the partial files.
- **REQ-MOD-004:** The manifest SHALL be derived automatically where possible (`config.json`, `tokenizer_config.json`, the `sentence-transformers` pooling config, model card) and confirmed by the user or a bundled profile where values cannot be inferred (for example, prefixes).
- **REQ-MOD-005:** WHEN a model is installed, the system SHALL run the family conformance suite and SHALL refuse activation if it fails.
  - Embedding: output length equals `dims`; the norm is close to 1 when `normalize`; a bundled set of 20 paraphrase and unrelated pairs keeps ordering in at least 18; re-embedding identical input gives cosine ≥ 0.999.
  - Text generation: 5 bundled extraction probes return schema-valid JSON in at least 4; the chat template renders; generation stops at `max_tokens`.
- **REQ-MOD-006:** Providers SHALL report the device actually used (`webgpu`, `wasm`, `cpu`, `cuda`, `metal`). That device is recorded in provenance, because it can change numeric output slightly.
- **REQ-MOD-007:** The system SHALL ship bundled "profiles" (recommended manifests for known-good models, per family and hardware tier) but SHALL allow any Hugging Face repo that passes REQ-MOD-004 and REQ-MOD-005.
- **REQ-MOD-008:** The scheduler SHALL limit concurrent inference to 1 generation job and 1 embedding batch, SHALL abort work for deleted sessions, and SHALL run text generation only WHEN `idle` reports idle or the user explicitly requests synthesis.

## 7. Data lineage & model swapping (LIN)

Vectors are only comparable inside one _embedding space_, and every generated statement records the model, prompt and inputs that produced it. A model swap therefore creates a new space or a new producer version. It never silently overwrites or mixes old outputs.

**Embedding spaces**

An embedding space is the full set of choices that determine what a vector means:

```ts
type SpaceId = string & { readonly __brand: "SpaceId" };

interface EmbeddingSpace {
  id: SpaceId; // sha256 of the canonical JSON of every field below
  model: ModelRef; // repo + commit SHA
  dims: number; // after any Matryoshka truncation
  pooling: string;
  normalize: boolean;
  similarity: "cosine" | "dot";
  prefixes: { query: string; document: string };
  chunker_version: string; // e.g. "chunker@2" (section 8)
  extractor_version: string; // e.g. "readability-0.6+clean@1"
  quantization?: string;
}

interface Vector<S extends SpaceId> {
  space: S;
  chunk_id: ChunkId;
  content_hash: string;
  data: Float32Array;
}

// Only compiles when both vectors share one space type; also asserts at runtime.
function similarity<S extends SpaceId>(a: Vector<S>, b: Vector<S>): number;
```

The compute device (WebGPU vs WASM vs native) is recorded per vector but is not part of the space ID. Conformance (REQ-MOD-005) guarantees cross-device cosine of at least 0.999.

**Provenance for generated artifacts**

```ts
interface Provenance {
  producer:
    | {
        kind: "model";
        model: ModelRef;
        provider: ProviderKind;
        device: string;
        prompt_id: string;
        prompt_version: number;
        params: Record<string, unknown>;
      }
    | { kind: "rule"; rule_id: string; version: number }
    | { kind: "user" };
  inputs: { node_id: NodeId; content_hash: string; chunk_ids?: ChunkId[]; fact_ids?: FactId[] }[];
  run_id: RunId;
  created_at: number;
}
```

Provenance is attached to every fact, summary statement, cluster label, comparison-table cell and open question.

**Requirements**

- **REQ-LIN-001:** Every vector SHALL store its `space` ID. The vector store SHALL be partitioned by space, so a query reads exactly one partition.
- **REQ-LIN-002:** Each session SHALL have one `active_embedding_space_id`. Similarity, clustering and entity resolution SHALL use only vectors from that space. A cross-space comparison SHALL throw `EmbeddingSpaceMismatchError` and be reported in the local diagnostics log.

  **Built so far (OpenSpec change `add-snapshot-embeddings`).**

  - **Spaces.** They are stored with their id, the SHA-256 of the canonical JSON of the model's repository and commit, dims, pooling, normalisation, similarity, prefixes, quantization, chunker and extractor versions.
  - **Vectors.** They are keyed `[space, chunk, part]`, so one space is one key range.
  - **Session space.** A session takes the space of its first vectors.
  - **The guard.** `compareVectors` throws `EmbeddingSpaceMismatchError`. Reporting it to the diagnostics log comes with its first caller.
  - **Not encrypted.** Vectors are not encrypted at rest. Embedding inversion can partly recover text from them, so encrypting them is a follow-up to REQ-SEC-005.

- **REQ-LIN-003 (embedding swap):** WHEN the user activates a different embedding model, the system SHALL create the new space, enqueue a re-embedding job from the stored text chunks, and keep using the old space until the new one covers 100% of the session's chunks. The switch SHALL be atomic per session.
- **REQ-LIN-004:** Old spaces SHALL be kept until the user confirms removal or 14 days pass after the switch, whichever comes first. The options page SHALL show disk usage per space.
- **REQ-LIN-005 (generation swap):** WHEN the active text-generation model or a prompt version changes, existing statements SHALL remain visible and labeled with their producer. They SHALL be regenerated only on user request or when their inputs change.
- **REQ-LIN-006 (staleness):** A generated artifact SHALL be marked `stale` WHEN any input `content_hash` changes, an input node is deleted, or its producer model is removed. Stale artifacts are shown dimmed with a "refresh" action.
- **REQ-LIN-007:** A single summary SHALL be produced by one model run. Comparison-table cells MAY come from different runs; each cell shows its own provenance on hover.
- **REQ-LIN-008 (rejections):** WHEN the user marks a statement wrong, the system SHALL store a rejection keyed by a normalized hash of (subject, attribute, value) and SHALL suppress matching statements from any future model. As built (`add-rejections`), the key is `factKey@1`: SHA-256 of the normalised subject and attribute and the value, in its base unit for a number, exact rather than within tolerance. A rejected fact is left out on read: in table cells, gaps, the CSV and a cluster's fact set. So summaries citing it turn stale and drop the citation. Rejections are kept per session, and "Restore all" undoes them.
- **REQ-LIN-009 (portability):** Saved sessions and exports SHALL include the manifests of every model and space referenced. WHEN a session is opened and a referenced model is missing, the system SHALL show the graph and existing synthesis read-only, fall back to structural clustering, and offer to re-embed with the currently active model.
- **REQ-LIN-010:** A local, content-free run log SHALL record each inference run (`run_id`, model ref, provider, device, duration, token counts, outcome) for debugging and lineage queries.

**Swap scenarios**

| Scenario                                                     | Behavior                                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Same model, new commit SHA                                   | New space; full re-embed (weights may differ).                                                         |
| Same model, different quantization                           | New space; full re-embed.                                                                              |
| Matryoshka dims reduced (for example 768 to 256)             | New space, but vectors MAY be derived by truncating and renormalizing instead of re-running the model. |
| Chunker or text-extractor version bump                       | New space; re-chunk from snapshots, then re-embed.                                                     |
| Text-generation model replaced                               | No new space; old statements keep their provenance; regeneration is opt-in.                            |
| Session imported from another machine with a different model | Read-only plus re-embed offer (REQ-LIN-009).                                                           |

## 8. Synthesis pipeline (SYN)

Synthesis is fact-first. The LLM extracts grounded facts from deep-read pages, and summaries, the comparison table and open questions are built from those facts. Every user-visible statement traces back to a quote on a page the user actually read.

**Pipeline stages (each a resumable job)**

1. **Extract text:** Readability output is cleaned (`extractor_version`) and stored as a snapshot (section 9).
2. **Chunk:** a sentence-aware chunker (`chunker@1`) targets about 220 words with 1-sentence overlap. It is model-independent; token limits are checked per model and oversize chunks are split.
3. **Embed:** document-role embeddings into the active space. Steps 2 and 3 run as an idempotent `embedSnapshot` job per snapshot and space, one at a time in the background, checkpointed per batch of 8. Chunks are stored as character ranges of the encrypted snapshot, never as text. An oversize chunk is split at word boundaries by an estimate of 1.4 tokens per word (OpenSpec change `add-snapshot-embeddings`).
4. **Extract facts:** the LLM receives one chunk per request and returns JSON matching `FactExtraction@1`, at most 12 facts per chunk (OpenSpec change `add-fact-extraction`). One chunk keeps a request inside Ollama's default 4,096-token context, bounds the answer, grounds each quote against exactly one chunk, and lets an `extractFacts` job checkpoint after every chunk. The job is queued only while a text-generation model is active, and takes a chunk only while the user is idle or locked, or after they chose "Extract facts now" (REQ-MOD-008). Fact text is encrypted at rest with the data key.
5. **Ground:** each fact's `quote` must appear in the source chunk (exact or whitespace-normalized match). Ungrounded facts are dropped and counted in the run log.
6. **Resolve entities:** merge entity mentions by normalized name, then by embedding similarity of at least 0.85 in the active space with the same `entity_type`. Merges are reversible by the user (OpenSpec change `add-entity-resolution`). A `resolveEntities` job runs per page once its extraction finishes. A match by meaning creates the mention's own entity, recorded as merged into the match, so "Separate" on "What was recorded" undoes it without rewriting facts. Only a new mention's entity is ever merged, so a separated one is never merged again. Entity names are encrypted at rest. Values are read into base units by `unitNormalizer@1` when facts are read: kg, mm, km, Wh (mAh kept), W, N·m, s and GB; percentages and currency codes are kept; a decimal comma is read, and a lone comma before exactly three digits groups thousands.
7. **Synthesize:** cluster summary, comparison table and gap list (below).

**Fact schema**

```ts
interface FactExtraction {
  entities: { name: string; entity_type: string }[];
  facts: { subject: string; attribute: string; value: string; unit?: string; quote: string }[];
}

interface Fact {
  id: FactId;
  session_id: SessionId;
  node_id: NodeId;
  chunk_id: ChunkId;
  entity_id: EntityId;
  attribute: string;
  value_raw: string;
  value_norm?: { number: number; unit: string };
  quote: string;
  status: "valid" | "stale" | "rejected";
  provenance: Provenance;
}
```

**Requirements**

- **REQ-SYN-001:** Only `deep_read` nodes, or nodes the user explicitly marks "include", SHALL feed fact extraction.
- **REQ-SYN-002:** Facts without a verified quote SHALL NOT be stored.
- **REQ-SYN-003 (summary):** A cluster summary SHALL be at most 8 statements. Each statement SHALL cite at least 1 fact ID and render as a link to the source page and quote. Statements that cite no valid fact SHALL be discarded after generation.
- **REQ-SYN-004:** Summaries SHALL be regenerated in the background, debounced to 60 s after the cluster's fact set changes, and only while the scheduler permits text generation (REQ-MOD-008). As built (`add-cluster-summaries`), the `clusterSummary@1` prompt receives up to 60 of the cluster's facts as labelled lines (`F1`…), spread across entities and pages, and cites labels that are mapped back to fact ids. A summary's job is identified by its fact set, so a change within the 60 s supersedes it. Staleness (REQ-LIN-006) is computed when summaries are read, from the fact set and the installed models, so no record is marked.
- **REQ-SYN-005 (generic comparison table):** Rows SHALL be entities of one `entity_type` chosen per table. Columns SHALL be proposed from the most frequent normalized attributes for that type (for example motor, battery capacity, range, weight and price for e-bikes) and editable by the user.
- **REQ-SYN-006:** Each cell SHALL show the selected value plus a count of alternatives. WHEN sources disagree beyond tolerance (numeric: more than 5% after unit normalization; text: not equal after normalization), the cell SHALL be flagged "conflict" and list every value with its source.
- **REQ-SYN-007:** The table SHALL export to CSV with a provenance column per cell (source URLs), saved locally through a Blob download from an extension page (no extra permission). As built (`add-comparison-table`), the table is computed from facts when read, with no model. Two values agree when they are numbers in one base unit within 5% of the larger, or text equal after normalisation. A cell's facts are grouped greedily against each group's first value, so near values cannot drift. The value most facts state is shown, ties going to more pages, then to the earlier fact. The CSV has an `Entity` column, then a value column and a sources column per attribute. It is RFC 4180 quoted, a field a spreadsheet would evaluate gets a `'` prefix, and the file starts with a BOM and ends lines in CRLF.
- **REQ-SYN-008 (gaps):** Rule-based gaps SHALL list empty cells for confirmed entities and source categories not yet visited (from `domain_category`). LLM-proposed open questions are optional, at most 5, and labeled as suggestions.
- **REQ-SYN-009:** Each gap item SHALL offer "search this", which opens a SERP for a generated query in a new tab that joins the current session. As built (`add-research-gaps`):
  - An entity is confirmed when facts about it come from at least two pages, and only the comparison table's shown columns are checked. At most 20 cell gaps are listed.
  - `domain_category` comes from the bundled `domainCategories@1` host table, and manufacturer sites are not recognised.
  - The search opens on the engine the session's searches used most, or DuckDuckGo, in a new tab added to the session's group. Each bundled engine carries a `searchUrl`, guarded to be one that capture recognises.
  - The open questions (`add-open-questions`) come from one `openQuestions@1` run over up to 60 of the session's facts, rejected ones left out. A `suggestQuestions` job keyed by the session's fact set queues them 60 s after the facts settle, inside the generation gate. They are stored encrypted, labelled as suggestions, and stale when the facts or the model change.
- **REQ-SYN-010:** All prompts SHALL live in versioned files (`prompts/<id>@<version>.md`) with JSON schemas alongside. A prompt change SHALL bump the version, which appears in provenance.
- **REQ-SYN-011:** Page text SHALL be passed to the model as delimited data with an instruction to ignore embedded instructions. Outputs are schema-validated, so injected text can at worst yield a wrong but grounded fact, never an action.

## 9. Storage, save & resume (STO)

All research data lives in one IndexedDB database in the extension's origin. Small settings live in `storage.local`. Vectors are stored as raw `Float32Array` buffers and searched by brute force, because a session holds thousands of chunks, not millions.

**IndexedDB object stores (`rg-db`, version 1)**

| Store                                                             | Key                   | Main indexes                                          | Contents                                   |
| ----------------------------------------------------------------- | --------------------- | ----------------------------------------------------- | ------------------------------------------ |
| `sessions`                                                        | `id`                  | `status`, `updated_at`                                | Session records                            |
| `nodes`                                                           | `id`                  | `session_id`, `cluster_id`, `[session_id+engagement]` | Graph nodes                                |
| `edges`                                                           | `id`                  | `session_id`, `[from+to+kind]`                        | Graph edges                                |
| `clusters`                                                        | `id`                  | `session_id`                                          | Labels, versions, user flags               |
| `snapshots`                                                       | `id`                  | `node_id`, `content_hash`                             | Readable text (compressed), captured\_at   |
| `chunks`                                                          | `id`                  | `snapshot_id`, `[content_hash+chunker_version]`       | Chunk text offsets                         |
| `vectors`                                                         | `[space_id+chunk_id]` | `space_id`                                            | Embedding buffers                          |
| `spaces`                                                          | `id`                  |                                                       | EmbeddingSpace records                     |
| `entities`, `facts`, `statements`, `tables`, `gaps`, `rejections` | `id`                  | `session_id`, `status`                                | Synthesis outputs with provenance          |
| `models`                                                          | `ref` (repo@sha)      | `family`, `active`                                    | Manifests and conformance results          |
| `model_files`                                                     | `[ref+path]`          |                                                       | Model weights (in-extension provider only) |
| `jobs`                                                            | `id`                  | `[status+priority]`, `session_id`                     | Job queue with checkpoints                 |
| `runs`                                                            | `run_id`              | `model_ref`                                           | Content-free run log                       |

**Requirements**

- **REQ-STO-001:** Schema migrations SHALL be forward-only, tested, and run in one `versionchange` transaction. A failed migration SHALL leave the previous version intact.
- **REQ-STO-002:** Snapshot text SHALL be compressed with `CompressionStream("gzip")` and encrypted at rest (REQ-SEC-005), in that order, since ciphertext does not compress.
- **REQ-STO-003 (save):** WHEN the user chooses Save research, the system SHALL flush pending signals, mark the session `saved`, record `last_position` (the most recent focused node and its scroll), store the tab list in order, and close the session's tabs. The flow SHALL complete in under 2 s for 100 nodes.
- **REQ-STO-004 (library):** The Research library SHALL list saved sessions with title, last-updated date, page count, deep-read count and a one-line status from the latest summary.
- **REQ-STO-005 (resume):** WHEN a saved session is opened, the graph and synthesis SHALL render within 1 s. Tabs SHALL be restored lazily (created with `discarded: true`) or on click, and the sidebar SHALL show "You left off at \<title> (\<n>% read)".

  **Built so far (OpenSpec change `add-save-and-resume`).**

  - **Save.** It asks each open page to flush, settles reading time, records `last_position` as the focused (or last focused) page and its read fraction, and stores the ordered tabs. It closes the session's nodes and tabs, keeping the window open.
  - **The library.** It lives in the popup when no session is active. Each entry shows title, saved date, page count and the left-off page. Deep-read counts and summary status wait for synthesis.
  - **Resume.** It reopens the tabs in a new group, every tab but the left-off page `discarded`. It reopens the same nodes rather than recording new ones; a commit of a tab's current URL is not a new page. The popup shows "You left off at …" until the user moves on.

- **REQ-STO-006 (reattach):** WHEN the user starts a session whose root query embeds within 0.8 cosine of a saved session's root (same space), or shares at least 60% of normalized query terms, the system SHALL offer to continue that session instead.

  **Built (OpenSpec change `add-session-reattach`).** The check runs when the new session records its first search.

  - **Terms.** They are lowercased and split on whitespace and punctuation other than inner hyphens, with stop words dropped. "60% of terms" is read as Jaccard overlap.
  - **Meaning.** With an active model, both queries are embedded in one call with the query role.
  - **The offer.** It is made in the popup, once.
  - **Continuing.** It moves the new session's records into the saved one, which becomes active on the current group under its own title. The new searches become refinements of its root. Its old tabs are not reopened.

- **REQ-STO-007 (export and import):** A session SHALL export to a single `.rgsession` file: a zip with JSON stores, snapshots, model and space manifests, and optionally vectors, encrypted with a user passphrase (AES-GCM, PBKDF2 with at least 600,000 iterations or Argon2id via WASM). Import SHALL validate schemas and apply REQ-LIN-009.
- **REQ-STO-008 (deletion):** Deleting a session SHALL remove every record keyed by its `session_id`, including vectors, snapshots and jobs, in one transaction. Deleting a node SHALL cascade to its snapshots, chunks, vectors and facts, and mark dependent statements stale. Both cascades are built, each as one transaction, through `sessionId` and `nodeId` indexes. Embedding spaces are kept as shared definitions. A deleted active session leaves its tab group open and unfollowed (OpenSpec change `add-recorded-data-view`).
- **REQ-STO-009:** The system SHALL call `navigator.storage.persist()` at first session start and SHALL show total disk use, with a per-session breakdown, in options.
- **REQ-STO-010 (jobs):** Jobs SHALL be idempotent, keyed by `(type, input hashes, producer version)` so duplicates are skipped, and SHALL checkpoint at least every 10 s of work. Failed jobs retry 3 times with backoff, then stay `failed` with a visible reason.

## 10. Privacy & security (SEC)

The only network traffic the extension originates is model downloads from Hugging Face, which carry no user data, and requests to a local inference server on loopback, which never leave the machine. The CSP enforces this for extension pages, the native host is socket-free by contract, and both are covered by automated egress tests.

**Threat model**

| Threat                                                  | In scope | Mitigation                                                                                                              |
| ------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| Research data leaking to any server                     | Yes      | CSP `connect-src` allowlist; no telemetry; content scripts never fetch; egress tests (section 13)                       |
| Malicious page text steering the LLM (prompt injection) | Yes      | REQ-SYN-011: data delimiting, schema-only outputs, no tool use, grounding check                                         |
| Tampered model files                                    | Yes      | Commit pinning and SHA-256 verification (REQ-MOD-002, REQ-MOD-003)                                                      |
| Other extensions reading research data                  | Yes      | Data lives only in this extension's origin; no `externally_connectable`; no `web_accessible_resources` that expose data |
| Pages detecting or fingerprinting the extension         | Yes      | No DOM injection on pages; content scripts run in isolated worlds and only listen                                       |
| Local attacker with full access to the user account     | No       | Recommend OS disk encryption; optional passphrase lock (REQ-SEC-006)                                                    |

**Requirements**

- **REQ-SEC-001:** Extension pages SHALL use a CSP whose `connect-src` allows only `'self'`, the enumerated Hugging Face hosts, and the local inference server on loopback (`http://127.0.0.1:11434`). Workers inherit it.
- **REQ-SEC-001a (local inference server):** The extension SHALL reach a local inference server (Ollama) only on loopback, only after the user grants its optional host permission from the options page, and SHALL send it nothing but the texts to embed or generate from and the model requests the user initiates. A model it serves SHALL be pinned to the digest the server reports and pass the conformance suite before use, like an installed model. As built (`add-egress-suite`), the server counts as connected only when its own origin is among the granted host permissions; page access (`<all_urls>`), which also covers loopback, does not count.
- **REQ-SEC-002:** Content scripts SHALL NOT call `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` or `EventSource`. Enforced by a lint rule and a bundle scan in CI.
- **REQ-SEC-003:** Model downloads SHALL be user-initiated from the options page, send no cookies or identifiers (`credentials: "omit"`), and support offline install from local files (a folder picker, or a path given to the native host).
- **REQ-SEC-004 (native host):** The native host SHALL communicate only over stdio native messaging, SHALL NOT open listening or outbound sockets except for user-initiated model downloads from Hugging Face, and SHALL default to `HF_HUB_OFFLINE=1` after install. Its manifest SHALL list only this extension's ID in `allowed_extensions`. Install locations: `~/.mozilla/native-messaging-hosts/` on Linux and `~/Library/Application Support/Mozilla/NativeMessagingHosts/` on macOS.
- **REQ-SEC-005:** Snapshots, facts and statements SHALL be encrypted at rest with AES-GCM using a non-extractable `CryptoKey` stored in IndexedDB. This protects against casual copying of profile files and other extensions, not against a full account compromise (see threat model). Snapshots are encrypted since OpenSpec change `add-snapshot-encryption`: one AES-GCM 256-bit data key, created on first need in the `keys` store, a fresh 96-bit IV per record, and the gzip of the text as the plaintext. The content hash, length, flags and times stay in the clear; they show which pages are equal, not what they say. Snapshots stored before encryption are sealed when the background next starts or is updated.
- **REQ-SEC-006:** Users MAY set a passphrase that wraps the data key (PBKDF2 or Argon2id). While locked, the extension records nothing and shows nothing.
- **REQ-SEC-007:** A default denylist SHALL cover banking, health, government, webmail and password-manager domains (bundled, versioned list), plus user-added sites. Denylisted pages produce no node, signals or snapshot. The bundled list is `capture_denylist@1`. A host matches it as a listed domain or a subdomain of one (`name.*` under any one- or two-label TLD), under a listed suffix such as `gov` or `gov.uk`, or by a label containing a listed word such as `bank`. Matching is by label, never by substring of the whole host. User-added sites are still to come (OpenSpec change `add-capture-denylist`). User-added sites (`add-site-denylist-editor`) are edited on the options page ("Sites never recorded"), entered as a host or any URL on it, and match with their subdomains, as a listed domain does. They are stored encrypted, in one record. Adding a site affects what is recorded from then on.
- **REQ-SEC-008:** A "What was recorded" view per session SHALL show, for every node, the stored signals, snapshot text and derived facts, each with a delete control. Built for the live session as `recorded.html`, opened from the popup. It shows each page's signals, snapshot size, the decrypted text on request and the vector count, with a delete control per page and for the session. There are no facts yet (OpenSpec change `add-recorded-data-view`).
- **REQ-SEC-009:** The extension SHALL collect no usage analytics. Metrics in the PRD are gathered through a local report the user can view, and export manually only if they choose.
- **REQ-SEC-010:** Third-party dependencies SHALL be pinned with a lockfile, audited in CI, and limited to packages that make no network calls.

## 11. UI surfaces (UI)

UI pages are thin views over background state. They subscribe to `graph.patch` streams and send intents; they never write storage directly.

**Surfaces**

| Surface          | Implementation                                    | Key elements                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toolbar action   | `action` button with a badge                      | Start research or Save; badge shows the unread count of the active session                                                                                                                      |
| Research tree    | The toolbar popup²                                | Root query, clusters (collapsible, renameable), page rows with engagement dot, unread badge and copy marker; a "Prune dead ends" action per cluster                                             |
| Synthesis panel  | A sidebar tab                                     | Cluster summary with citations, comparison table, gaps and open questions, freshness and stale markers                                                                                          |
| Research map     | `map.html` in a tab; React Flow with dagre (DOM)¹ | Four views behind a switcher (keys 1–4, kept in the address)³: simple history, the tree, anchors, and a telemetry timeline coloured by cluster with a text preview on hover; click to focus tab |
| Research library | A sidebar view and `library.html`                 | Saved sessions, resume, rename, export, delete                                                                                                                                                  |
| Options          | `options_ui` page                                 | Models (install, activate, conformance results, disk use per model and space), denylist, passphrase, data deletion, "What was recorded"                                                         |

**Requirements**

- **REQ-UI-001:** The research tree SHALL render the first paint of a 300-node session within 300 ms and apply patches within 100 ms.
- **REQ-UI-002:** All actions SHALL be keyboard accessible, and the tree SHALL follow the WAI-ARIA tree pattern. Color is never the only carrier of engagement state.
- **REQ-UI-003:** Destructive actions (prune, delete session, delete node) SHALL be undoable for 10 s or confirmed with a dialog. Deleting a page or a session (OpenSpec change `add-recorded-data-view`) takes the confirmation option: an inline second button naming what will be deleted, never a browser dialog.
- **REQ-UI-004:** Every generated statement and table cell SHALL expose its provenance (source page, quote, model, date) on hover or focus.
- **REQ-UI-005:** The UI SHALL show the inference state honestly: "No model installed", "Running on CPU, synthesis is slower", "Waiting for idle", "Re-embedding: 40%".
- **REQ-UI-006:** The UI SHALL follow the Firefox light and dark theme (`prefers-color-scheme`) and system font settings.
- **REQ-UI-007:** The framework SHALL be lightweight (Preact or Svelte), and the bundle per UI page SHALL stay under 300 KB gzipped, excluding the map's graph library.

¹ The first map (OpenSpec change `add-research-map`) is drawn with React Flow and laid out top-down with dagre, instead of graphology with sigma.js. React Flow renders each node as a DOM element. That gives every node keyboard focus (REQ-UI-002), lets unit and end-to-end tests read the map from the DOM, and lets a node carry rich content such as the engagement dot and the unread badge. React Flow's group nodes also cover the cluster bubbles. A session's graph is a few hundred nodes (REQ-UI-001), which DOM rendering handles. Move to sigma.js when the map has to show thousands of nodes at once, for example across the whole library. Only the map component would change: the snapshot message and the layout input stay the same.

² The research tree lives in the toolbar popup rather than a `sidebar_action` (OpenSpec change `add-popup-research-tree`), so the user has one surface to learn and no sidebar takes width from the pages being read. It shows the session's pages nested by how they were reached, each row's engagement in words and by marker shape, a copy marker and the closed state, an unread queue above it, and follows the WAI-ARIA tree pattern. It updates live over the same `graph.subscribe` stream as the map. Clusters, renaming and pruning wait for M2. The sidebar rows of the execution-context table and the "left off at" line of REQ-STO-005 read as the popup until a sidebar is reconsidered.

³ The four views (OpenSpec change `add-map-views`) follow the "Discovering User Intent" demo. _Simple history_ lists every stretch of reading in order. _Anchors_ draws the pages that meet `anchor_rules@1` (at least 2 revisits, 2 copies and pastes, or 3 minutes of reading) on a ring around the session's first page, joined by the moves between them, with "Show paths" adding the rest of the tree. _Telemetry_ draws the activity log as blocks on a time axis, coloured by cluster with the validated eight-slot categorical palette, taller for longer reads, with copy (●) and paste (■) marks, pauses over 15 minutes as breaks, and the start of the page's captured text on hover. Radial cluster bubbles remain open.

## 12. Non-functional requirements (NFR)

Budgets assume two reference machines: an Apple M1 MacBook Air with 8 GB RAM, and a Linux laptop with a 4-core x86\_64 CPU, 16 GB RAM and no usable WebGPU.

| ID          | Requirement                                                                                                                                                         | Budget                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| REQ-NFR-001 | Node creation latency after tab or navigation event                                                                                                                 | ≤ 1 s p95                                                                   |
| REQ-NFR-002 | Content script cost per signal event                                                                                                                                | ≤ 1 ms p95 main thread                                                      |
| REQ-NFR-003 | Background memory without models loaded                                                                                                                             | ≤ 150 MB                                                                    |
| REQ-NFR-004 | Embedding throughput, in-extension provider, small model (around 30M parameters, q8, WASM)                                                                          | ≥ 20 chunks/s on both machines                                              |
| REQ-NFR-005 | Embedding model disk footprint (default profile)                                                                                                                    | ≤ 150 MB                                                                    |
| REQ-NFR-006 | In-extension text generation: model size ceiling                                                                                                                    | ≤ 1.5B parameters q4; larger models require the native host                 |
| REQ-NFR-007 | Fact extraction for one deep-read page (about 1,500 words)                                                                                                          | ≤ 60 s in-extension on M1; ≤ 20 s with the native host and a 3B to 4B model |
| REQ-NFR-008 | Storage for a typical session (100 nodes, 40 deep reads, one space)                                                                                                 | ≤ 25 MB                                                                     |
| REQ-NFR-009 | Clustering recompute, 300 nodes                                                                                                                                     | ≤ 200 ms p95                                                                |
| REQ-NFR-010 | Session restore to first paint                                                                                                                                      | ≤ 1 s                                                                       |
| REQ-NFR-011 | Battery: no inference while on battery below 20%, where the OS exposes it to the native host; in-extension jobs throttle to embeddings only when the user is active | Policy                                                                      |
| REQ-NFR-012 | Crash or kill of the native host or inference worker                                                                                                                | Jobs resume; UI shows a degraded state; no data loss                        |

## 13. Testing strategy

Every requirement ID maps to at least one automated test, except UX requirements that are verified in moderated studies. CI runs on Linux and macOS against Firefox ESR 140 and the current release.

| Layer                    | Tooling                                                                                                          | Covers                                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                     | Vitest, fake-indexeddb, mocked `browser.*`                                                                       | Engagement rules, graph builder, clustering, chunker, grounding, unit normalization, provenance and staleness                                 |
| Property and replay      | fast-check, a recorded-session corpus (JSON event logs)                                                          | Clustering stability (REQ-CLU-005), idempotent jobs, migration round-trips                                                                    |
| Lineage invariants       | Dedicated suite                                                                                                  | No cross-space similarity is ever computed; a swap never leaves a session with mixed spaces; rejected facts never reappear; stale propagation |
| Model conformance        | Bundled golden sets per family (REQ-MOD-005)                                                                     | Run at install time and in CI against each bundled profile                                                                                    |
| Integration (end to end) | `web-ext run` plus WebDriver BiDi (`webExtension.install`) driving Firefox; local fixture sites served offline   | Session start, capture, save and resume, sidebar patches, export and import                                                                   |
| Egress                   | End-to-end runs behind a logging proxy, plus the native host under a network-namespace or `strace` check         | Zero requests except to Hugging Face during explicit model install (REQ-SEC-001 to REQ-SEC-004)                                               |
| Performance              | Scripted sessions, Firefox profiler markers                                                                      | NFR budgets, as release gates                                                                                                                 |
| Lint and packaging       | `web-ext lint`, the addons-linter, custom ESLint rules (`no-direct-model-import`, no network in content scripts) | REQ-RT-006, REQ-RT-007, REQ-MOD-001, REQ-SEC-002                                                                                              |
| Prompt evals             | A labeled fact-extraction set of 50 pages across 3 domains                                                       | Precision ≥ 0.9 and grounded rate ≥ 0.95 per prompt version and model profile; a regression blocks release                                    |

As built (`add-egress-suite`), the egress check is `e2e/specs/egress.e2e.ts`. It does not use a proxy. It records, from Firefox's chrome context, every HTTP request whose principal is the add-on. It proves that it sees one, then runs a session and asserts none, apart from tabs the add-on opened at the user's request.

As built (`add-accessibility-audit`), `e2e/specs/accessibility.e2e.ts` runs axe-core inside each extension page in Firefox against WCAG 2.0 and 2.1 A and AA, with a planted-violation control. Keyboard, screen-reader and dark-theme checks remain manual.

As built (`add-performance-gates`), the following budgets are gated:

- REQ-NFR-001 in `e2e/specs/performance.e2e.ts`, as the p95 of 20 navigations to their node's `createdAt`;
- REQ-NFR-003 in the same spec, as the extension process's settled memory after `minimizeMemoryUsage`, an upper bound shared with Firefox's built-in add-ons;
- REQ-NFR-009 in `clusterSession`'s unit spec.

The following are not gated:

- NFR-002, which needs an in-page profiler marker;
- NFR-004 and NFR-007, which are measured in the opt-in network run;
- NFR-008, estimated at about 1 MB for a typical session;
- NFR-010.

## 14. Implementation tasks

Work proceeds in six milestones. M0 spikes de-risk platform assumptions before anything else is built, and every task names the requirements it closes.

**M0: Spikes**

- [x] M0-1: Event-page lifetime. Re-scoped from the in-extension worker to a background job waiting on a long Ollama answer with no extension page open (`spike-event-page-lifetime`). Result on Firefox 157 release, macOS: the page is unloaded one idle timeout after its last event, whatever it awaits; a read-only API call every 5 s while a job runs keeps it loaded; and a `jobs.wake` alarm wakes an unloaded page, which hands back the interrupted job and resumes it from its checkpoint. The job runner now does both. No pinned page is needed. ESR 140 and Linux are recorded in the change's Findings as checked or not. (RT-004, RT-005)
- [ ] M0-2: Transformers.js v4 inside the extension CSP (`wasm-unsafe-eval`), with WASM threads availability, WebGPU on Apple Silicon, and WASM fallback on Linux. Benchmark one embedding model and one small text-generation model against NFR-004 and NFR-007. (MOD, NFR)
- [ ] M0-3: Enumerate the Hugging Face download hosts (redirects, LFS or Xet CDN) and verify downloads succeed under the CSP allowlist. (SEC-001)
- [ ] M0-4: Native messaging round trip on Linux and macOS with a Python host, including chunked messages over 1 MB and host restart. (SEC-004) — **Replaced for now by the Ollama spike** (`spike-ollama-provider`): a local Ollama server on loopback serves embeddings, and after its gate, generation, in place of a custom native host. A native host is reconsidered only if Ollama proves unsuitable.

**M1: Capture and graph**

- [x] Project scaffold: TypeScript, Vite, `web-ext`, ESLint rules, CI matrix. (RT-006, RT-007) Built as WXT with oxlint and oxfmt (`bootstrap-popup-scaffold`). There is no CI matrix yet; `npm run verify` is the gate.
- [x] Session lifecycle, explicit start, permission request, dynamic content-script registration. (RT-001 to RT-003) (`add-session-store`, `add-session-restore`, `add-tab-capture`)
- [x] Tab, navigation and SERP capture; active dwell; engagement rules; co-attention edges. (CAP-001 to CAP-008, CAP-010) (`add-tab-capture`, `add-serp-detection`, `add-engagement-signals`, `add-co-attention-edges`)
- [x] IndexedDB schema v1, migrations framework, job queue. (STO-001, STO-010) (`add-graph-store`, `add-job-queue`)
- [x] Research tree in the popup, with live updates and the unread queue. (UI-001 to UI-003) (`add-popup-research-tree`)

**M2: Clustering and embeddings**

- [x] Fused graph and Louvain with warm start, identity matching and hysteresis. (CLU-001 to CLU-006) (`add-structural-clustering`, `add-semantic-cluster-edges`)
- [x] Model registry, manifest derivation, download and verification, conformance suite. (MOD-001 to MOD-005) (`spike-huggingface-inference`)
- [x] `ext-ort` provider and inference worker. (MOD-006, MOD-008) (`spike-huggingface-inference`)
- [x] Embedding spaces, branded vectors, partitioned store. (LIN-001, LIN-002) (`add-snapshot-embeddings`)
- [x] Readability extraction, snapshots, chunker, encryption at rest. (CAP-006, STO-002, SEC-005) (`add-snapshot-embeddings`, `add-snapshot-encryption`)

**M3: Save and resume**

- [x] Save, library, lazy restore, "left off at". (STO-003 to STO-005)
- [x] Reattach suggestion. (STO-006)
- Export and import moved to the end of the roadmap, after M6, by the maintainer's decision (2026-10-13). (STO-007, LIN-009)
- [x] Deletion cascades and the "What was recorded" view. (STO-008, SEC-008)

**M4: Synthesis**

- [x] Versioned prompts and schemas; fact extraction with grounding. (SYN-001, SYN-002, SYN-010, SYN-011) The user's "include" mark for pages that are not deep read is still open.
- [x] Entity resolution and unit normalization. (SYN pipeline step 6)
- [x] Cluster summaries with citations and staleness. (SYN-003, SYN-004, LIN-006) Shown on a "Summaries" extension page opened from the popup until the sidebar exists (`add-cluster-summaries`).
- [x] Generic comparison table with conflicts and CSV export. (SYN-005 to SYN-007) On the Synthesis page, below the summaries (`add-comparison-table`).
- [x] Gaps and open questions with "search this". (SYN-008, SYN-009) Rule-based gaps (`add-research-gaps`) and the questions the model suggests (`add-open-questions`), on the Synthesis page.
- [x] Rejections. (LIN-008) Per session, on the Synthesis page (`add-rejections`).

**M5: Native host and model swap**

- Native host package for Linux and macOS (installer script, manifest placement, offline mode). (SEC-004) **Replaced by Ollama** as the local server (`spike-ollama-provider`). Reconsidered only if Ollama proves unsuitable.
- `native` provider; capability handshake with protocol versioning. (MOD) **Replaced by the Ollama provider**, with its model status check standing in for the handshake.
- [x] Embedding swap with re-embed migration and space retention; text-generation swap behavior. (LIN-003 to LIN-005, LIN-007) (`add-model-swap`) A session switches space when the new one covers all its chunks. Retired spaces keep their vectors 14 days or until removed on the options page. A generation swap keeps existing facts, summaries and questions, labelled with their producer.
- [x] Research map page. (UI) (`add-research-map`)

**M6: Hardening and beta**

- [x] Egress test suite, performance gates, accessibility audit. (Section 13) Built as `add-egress-suite`, which also fixed Ollama being polled once page access was allowed; `add-accessibility-audit`, axe against WCAG 2 A and AA on every extension page; and `add-performance-gates`, which gates NFR-001 and NFR-003 in e2e, with NFR-009 in unit.
- [ ] Passphrase lock and denylist editor. (SEC-006, SEC-007) The denylist editor is built (`add-site-denylist-editor`); the passphrase lock is still open.
- [ ] Page access granted at install: move `<all_urls>` from `optional_host_permissions` to `host_permissions`, so a session no longer needs an "Allow page access" click; keep the popup's re-request for access revoked in about:addons. Open details: the stricter install prompt and AMO review, whether temporary installs (`npm run dev`) get the grant, and the `extension-shell` and `research-session` spec changes. Added by the maintainer's request (2026-10-13). (RT-002)
- [ ] AMO submission with source and build instructions; beta onboarding. (RT-007)

**Last: Export and import**

- [ ] Session export to an encrypted `.rgsession` file and import with portability checks; deferred here from M3. (STO-007, LIN-009)

## 15. Risks & open decisions

| Risk or decision                                                                          | Impact                                       | Mitigation or next step                                                                                  |
| ----------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Linux has no WebGPU in stable Firefox yet; WASM generation is slow                        | Weak in-extension synthesis on Linux         | Native host is the recommended Linux path; embeddings stay in-extension; re-test WebGPU each release     |
| Event-page unload interrupts long inference                                               | Lost work, stalls                            | Running jobs hold the page with an API call every 5 s; a wake alarm resumes a job unloaded anyway (M0-1) |
| Small local LLMs extract facts poorly                                                     | Wrong or missing table cells                 | Grounding check, conformance probes, prompt evals as a release gate, native host for 3B to 8B models     |
| Embedding swap cost on large libraries                                                    | Long re-embed times, disk growth             | Background migration, per-session switching, space retention limits, Matryoshka truncation when possible |
| AMO review of WASM and large bundles                                                      | Delayed listing                              | No remote code, reproducible builds, source submission                                                   |
| `browser.trial.ml` evolves into a stable API                                              | Opportunity: shared models across extensions | Keep the provider interface; re-evaluate each quarter                                                    |
| **Decision:** default model profiles per tier                                             | Affects quality, size and licensing          | Choose after M0-2 benchmarks; record in an architecture decision record (ADR)                            |
| **Decision:** native host language (Python vs a Rust plus llama.cpp binary)               | Install size, packaging, signing on macOS    | Prototype both in M0-4; pick by install friction                                                         |
| **Decision:** import of tabs opened before session start (from the PRD open questions)    | Scope of capture                             | Default no; revisit after beta feedback                                                                  |
| **Decision:** attribute definition for non-product entities (from the PRD open questions) | Comparison table quality                     | Model-proposed columns with user edits in v1; templates later                                            |
