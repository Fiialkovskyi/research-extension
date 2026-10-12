# Design

## Context

- **The node already has room for signals.** `StoredNode.signals` holds `activeDwellMs`, `maxScroll`, `copyEvents`, `focusCount` and `revisitCount`. `researchGraph/addNodeSignals` folds a `SignalObservation` into a node inside one `readwrite` transaction: counts add up, while `maxScroll` and `lastFocusedAt` keep their largest value. Only `recordTabFocus` writes to it today (`focusCount`, `lastFocusedAt`).
- **The `research-graph` spec forbids storing derived values.** It says: "Derived values, such as the engagement state, SHALL NOT be stored." The engagement state must therefore be computed wherever it is read.
- **No content script exists.** The manifest declares `tabGroups`, `tabs`, `webNavigation` and `sessions`. Its host permissions cover only the model hosts. `runtime.onMessage` hands `app.handleMessage` the message alone, without its sender.
- **Capture has one serial queue.** `serializeWork` / `captureAndPush` in `app/backgroundApp` run capture steps in arrival order and coalesce the map push. A new signal step joins the same queue, so a batch can never interleave with the commit that replaces its node.
- **A node closes when its tab navigates on.** After a commit, `readTabNode` returns the new node, and the previous one is linked to it as `parentNodeId`.
- **Database version 6.** Migrations are forward-only steps in `applyDatabaseUpgrade`.
- **Active dwell is specified but not numbered.** The target spec has it only in the event-source table ("Focus and active time": `tabs.onActivated`, `windows.onFocusChanged`, `idle.onStateChanged` with a 60 s threshold), in `signals.active_dwell_ms`, and in the engagement table. Its manifest already lists `idle` and `scripting`, and gives `<all_urls>` as an optional host permission.
- **`recordTabFocus` counts an activation** (`focusCount`, `lastFocusedAt`). Nothing measures time.

## Goals / Non-Goals

**Goals:**

- Run code only in session tabs, and only in their top frame.
- Keep the in-page script small, free of React, and testable under jsdom with its browser inputs injected.
- Encode the rule set once and version it.
- Measure dwell where the browser already reports focus — the background — so it works without page access and keeps nothing only in memory.
- Never pull Readability into the background bundle, and never pull background code into the content script.

**Non-Goals:**

- **`dead_end` by returning to the SERP within 10 s.** It needs to know which SERP a page was reached from and when focus went back there; it is left out of `engagement_rules@1` and named in the target spec.
- **Co-attention edges (REQ-CAP-007),** even though the focus intervals here are what they will be built from.
- **Single-page-app navigation (`pushState`).** Capture does not record it as a node, so this change does not either.
- **Encryption at rest (REQ-SEC-005) and the denylist (REQ-SEC-007).** Both are gaps, listed under Risks.
- **Chunking, embedding and any use of the stored text.**

## Decisions

### The script is injected into session tabs, not registered for every page

`scripting.executeScript({ target: { tabId, frameIds: [0] }, files: [PAGE_OBSERVER_PATH] })` runs at these points:

- right after capture records a node for a commit (`recordNavigation`);
- when a tab joins the group or comes back restored (`followTabMembership`);
- at reconciliation (`reconcileSessionTabs`);
- on `permissions.onAdded`, for every open session tab.

**Rejected alternative:** REQ-RT-003's `scripting.registerContentScripts` while a session is active. That would inject into every page in every window, and the background would then have to discard what came from tabs outside the group. REQ-CAP-004 already says those tabs are not captured, and with injection by tab they are not even observed.

Injection failures are swallowed rather than reported. They are the expected outcome when:

- page access was refused;
- the page is restricted, such as `addons.mozilla.org`;
- the tab navigated away in the meantime.

The script guards against running twice in the same document with a marker on its own isolated global. A second injection, for example by reconciliation, does nothing.

REQ-RT-003 in `RESEARCH_GRAPH_EXTENSION_SPEC.md` is rewritten to say this.

### The script is wiring; the logic sits in features

- **Entrypoint:** `src/entrypoints/pageObserver.content/index.ts` calls `defineContentScript({ registration: "runtime", main })`. WXT builds it to `content-scripts/pageObserver.js` without adding a manifest entry.
- **Observer:** `main` calls `features/pageSignals/model/observePage`. It receives `window`, `document`, `send`, `now`, `requestFrame` and the timer functions as dependencies, so the batching rules run under jsdom with fake time.
- **Extractor:** `observePage` takes `extract` as a dependency as well. The entrypoint passes `features/pageSnapshots/model/extractReadableText`, which wraps `@mozilla/readability`.
- **Import paths:** the entrypoint imports both modules **by path**. Neither feature barrel exports them, and each barrel carries a comment explaining why. The barrels export only the background half: message schemas, attribution, recording and injection. So the background never bundles Readability, and the content script never bundles the database.

### Batching

`observePage` keeps two readings.

- **`maxScroll`** is an absolute reading, `min(1, (scrollY + innerHeight) / scrollHeight)`. The background keeps the larger of the stored and received values, so resending it is harmless.
  - A passive `scroll` listener only sets a flag and asks for one animation frame. The frame callback does the measuring.
  - So the per-event cost is a flag check, and there is at most one layout read per frame.
  - The script also measures once when it starts.
- **`copyEvents`** is a delta since the last send. The background adds it to the stored count.
  - Only `isTrusted` copy events count, so a page cannot fake a deep read.
  - The listener reads neither the clipboard nor `getSelection()`.

**When a batch is sent:**

- A change starts a 2 s timer, and the batch goes out when it fires.
- `visibilitychange` to hidden and `pagehide` send at once and cancel the timer.
- A batch whose scroll did not grow and that has no copies is not sent.

### Content messages have their own path and their own schemas

`signal.batch` (`{ maxScroll, copyEvents }`) and `content.extracted` (`{ text, truncated, extractorVersion }`) live in a schema map of their own. They are not in `requestSchemas`, so neither side can send the other's messages:

- a surface such as the popup or the map cannot send them;
- a content script can send nothing else.

The background entrypoint routes by sender:

- a message from a tab, other than an extension page, goes to `app.handleContentMessage(message, { tabId, frameId, url })`;
- everything else goes to `handleMessage`, as before.

Only the browser-supplied `sender` says which tab sent a message. The payload never carries a tab id or a node id.

Replies:

- `signal.recorded`;
- `signal.dropped { stop }`;
- `content.stored`;
- `content.dropped`.

### Attribution: the current node, or the one it just replaced

A message is attributed inside the capture queue. Fragments are ignored when URLs are compared.

1. **If the tab has no open node in the active session**, drop the message and reply `stop: true`. The tab left the group, or the session ended, and the script detaches its listeners.
2. **If the sender URL equals the current node's URL**, attribute the message to the current node.
3. **Otherwise, if it equals the URL of the current node's `parentNodeId`**, attribute it to that parent. This is the page just left, whose `pagehide` flush lost the race with the next commit.
4. **Otherwise**, drop the message with `stop: false`. A newer document in the tab has, or will have, its own script.

Rule 3 is what makes the "Leaving the page" scenario hold whichever order the two events arrive in.

### Active dwell is measured in the background from focus events

The session record keeps the open visit, as an optional field that needs no migration:

```ts
StoredSession.focus?: {
  nodeId: string;
  since: number | null;    // start of the running interval; null while the window is unfocused or the user idle
  visitDwellMs: number;    // dwell of this visit so far
  isRevisit: boolean;      // the node already had dwell when the visit began
  isRevisitCounted: boolean;
}
```

`tabCapture/model/trackActiveDwell({ database, focusedTabId, now })` re-evaluates focus whenever something may have changed it:

1. It closes the running interval. The interval is `min(now - since, 10 min)`. It is added to that node's `activeDwellMs` through `addNodeSignals`, and to `visitDwellMs`. A revisit that reaches 20 s adds one to `revisitCount`, once per visit.
2. It resolves the target: the open node that `focusedTabId` shows in the active session, if any.
   - If that is the same node, the visit continues and `since` becomes `now`.
   - If it is another node, a new visit starts. `isRevisit` is true when that node's dwell is already above 0.
   - If there is no target, the visit is kept, with `since: null`. A tab switch made while the window is unfocused cannot happen, so coming back to the same node resumes the visit rather than starting one.

**Where `focusedTabId` comes from.** It is an injected `readFocusedTab()`. That function calls `windows.getLastFocused()`; if the window is focused, and `idle.queryState(60)` is `active`, it returns the window's active tab. Asking the browser each time avoids any in-memory state the event page could lose.

**When it runs.** It runs on the capture queue after:

- `tabs.onActivated`;
- `windows.onFocusChanged`;
- `idle.onStateChanged`;
- a commit;
- a group change;
- a tab removal;
- every `signal.batch`, which keeps an open interval current while the user scrolls.

`idle.setDetectionInterval(60)` is called at the top level of the background.

**Idle timing.** When the state goes to `idle` or `locked`, `now` is moved back by the 60 s threshold, which is when input actually stopped. It never goes earlier than `since`.

**Restarts and sleep.** The 10-minute cap bounds a lost event: a crash, or sleep without an idle report. At start-up reconciliation, an interval left open by the previous run is dropped rather than counted.

**Rejected alternative: dwell measured in the content script** (visible + `hasFocus()` + no input). It would need page access, so it would not exist in degraded mode. It would also guess idleness instead of asking the system, and it would split one tab's time across documents.

### Engagement is a pure function over signals

`researchGraph/model/getNodeEngagement(node, { isFocused })` reads its thresholds from `shared/config/engagementRules`, which holds the version `engagement_rules@1` and every threshold. The rules are checked in this order:

| State       | Rule                                                                      |
| ----------- | ------------------------------------------------------------------------- |
| `unread`    | `focusCount === 0`                                                        |
| `deep_read` | dwell ≥ 45 s and scroll ≥ 0.4, or `copyEvents ≥ 1`, or `revisitCount ≥ 2` |
| `dead_end`  | not focused now, dwell < 8 s and scroll < 0.15                            |
| `skimmed`   | otherwise                                                                 |

**Why `isFocused`.** A page the user has looked at for 3 s is not yet a dead end, and showing it as one on the map would be wrong. The caller passes `session.focus?.nodeId === node.id`.

**`revisitCount ≥ 2`** stands for the target's "2 revisits with 20 s or more each", because a revisit counts only once it reaches 20 s.

The function lives in `researchGraph`, beside the node, because three places read it:

- `buildGraphSnapshot`, for the map;
- the batch handler;
- the dwell tracker, to decide on extraction.

### Extraction is asked for by the background and happens once per page

A node can become `deep_read` in two ways: through a batch (a copy, or scroll), or through dwell, when an interval closes, even with no batch at all. So the background asks for the text itself, and does not use the batch reply.

`pageSnapshots/model/readSnapshotCandidate(database, nodeId)` returns the node when three conditions hold: it is open, it is `deep_read`, and it has no `snapshotId`. After a batch or a dwell update, the app calls it for the node concerned. If the node qualifies, the app calls the injected `requestPageText(tabId)`, which sends `tabs.sendMessage(tabId, content.extract, { frameId: 0 })` and swallows failures. An unobserved tab simply does not answer.

On `content.extract`, the script:

1. runs Readability on `document.cloneNode(true)`, so the page the user sees is untouched;
2. truncates the text to 200 KB of UTF-8, cutting at a character boundary;
3. sends `content.extracted`.

The script extracts at most once per page lifetime. If Readability finds no text, it sends nothing and does not try again. That is the spec's "not retried for the rest of its page's life". No retry flag is stored.

`pageSnapshots/model/recordSnapshot` handles `content.extracted` in the capture queue. It attributes the message the same way as a batch, then:

1. computes SHA-256 with `crypto.subtle` in the background;
2. gzips the text with `CompressionStream`;
3. in one `readwrite` transaction over `nodes` and `snapshots`, re-checks that the node still has no snapshot, adds the snapshot and sets `node.snapshotId` and `node.contentHash`.

A duplicate `content.extracted` therefore stores nothing.

**Rejected alternative:** hashing in the page, as REQ-CAP-006 words it. `crypto.subtle` exists only in secure contexts, so it is missing on plain-`http` pages. Hashing in the background also makes the background, not the page, the authority on the hash. REQ-CAP-006 is annotated to say so.

### Storage: version 7 adds `snapshots`

```ts
StoredSnapshot {
  id: string;            // UUID
  sessionId: string;
  nodeId: string;
  contentHash: string;   // hex SHA-256 of the stored (possibly truncated) text
  byteLength: number;    // UTF-8 bytes before compression
  truncated: boolean;
  extractorVersion: string; // "readability@<pkg version>/1"
  capturedAt: number;
  compressedText: ArrayBuffer; // gzip
}
```

- **Fields:** `StoredNode` gains `snapshotId?` and `contentHash?`. Both are optional, so no existing record is rewritten.
- **Migration:** step 7 only creates the store.
- **Indexes:** none. Nothing queries snapshots except by id, which the node carries. The `sessionId` index arrives with session deletion (REQ-STO-008), which is the first query that needs it (STORAGE §6.3).
- **Compression:** gzip with `CompressionStream` meets REQ-STO-002's compression half.

### Page access is requested from the popup's click

`<all_urls>` goes under `optional_host_permissions`, and `scripting` is added to `permissions`.

- **Granted state:** when the popup opens, it reads `permissions.contains({ origins: ["<all_urls>"] })` and keeps the result.
- **Requesting on submit:** if access is not granted, the submit handler calls `permissions.request(...)` **synchronously, before any `await`**. Firefox accepts a permission request only while the user gesture is live.
- **Sending `tabGroup.create`:** it goes out in the same tick, without waiting for the answer. Showing the prompt may close the popup, and the session must start anyway.
- **Page access notice:** for an active session without access, the popup shows a notice and an "Allow page access" button, which makes the same synchronous call.
- **Granting later:** the background hears `permissions.onAdded` and injects into the open session tabs.

### The map shows the state in words and by shape

- **Map data:** `mapNodeSchema` gains `engagement` (picklist), and `buildGraphSnapshot` derives it.
- **Rendering:** `MapPageNode` adds a marker before the title, and the state in words to the secondary line, for example `example.com · deep read`. It also sets `data-engagement` for tests.

| State     | Marker             |
| --------- | ------------------ |
| unread    | hollow circle      |
| skimmed   | half-filled circle |
| deep read | filled circle      |
| dead end  | cross              |

The existing coalesced graph push already sends the change to the map once the batch is merged.

### End-to-end

- **Profile:** `buildProfilePreferences` sets `extensions.webextOptionalPermissionPrompts: false`, so the request is granted without a prompt.
- **Page server:** it serves `article.html`, several viewports tall with a real `<article>`.
- **Fixtures:** they gain:
  - helpers to scroll a tab's page and to copy a selection with a real key chord (Cmd on macOS, Ctrl elsewhere), so the copy event is trusted;
  - readers for node signals, `contentHash` and the `snapshots` store;
  - `data-engagement` on map nodes.

## Risks / Trade-offs

- **[Page text is stored unencrypted]** → It is compressed and local only, and never leaves the profile. Encryption (REQ-SEC-005) must land before the extension is used for real research. The proposal names this gap.
- **[No denylist yet]** → A banking or webmail page placed in the session group and copied from would be snapshotted. The denylist (REQ-SEC-007) is the next change after this one, and REQ-SEC-007 already says denylisted pages produce no signals or snapshot.
- **[Dwell counts a mouse-only reader as active, and a still reader as idle after 60 s]** → That is the target spec's definition. The threshold lives in `engagementRules`, so it can be tuned without changing the rules.
- **[Dwell only advances on events]** → While a reader neither scrolls nor switches, the stored dwell lags until the next event. The map and extraction catch up when focus moves. That is accepted: deep read is decided correctly, just late.
- **[A page deep-read by dwell after it was navigated away from]** → It gets no snapshot, because its document is gone. The spec only promises a snapshot while the page is open.
- **[The `pagehide` flush may be lost when the document is torn down]** → Firefox delivers a message posted during `pagehide` in practice. At worst the last ≤2 s of scroll is lost, which the max-scroll reading tolerates.
- **[Single-page apps]** → After `pushState` the sender URL no longer matches, so batches are dropped (`stop: false`). The data is lost but never misattributed. Handling `pushState` is a capture change.
- **[Injection races the commit]** → `executeScript` may run before the document is ready, or land in a document that is already being replaced. The isolated-global marker makes repeats harmless, and attribution drops whatever comes from the wrong document.
- **[The popup may close on the permission prompt]** → The create message is already sent. The prompt's answer reaches the background through `permissions.onAdded`.
- **[REQ-CAP-005's 1 ms p95 is not observable from the e2e harness]** → Unit tests assert the structure: one frame request per burst, and no layout read in the listener. The p95 figure is measured once with the Firefox Profiler on `article.html` and recorded here as a Finding.

## Migration Plan

- **Database:** version 7 is additive and forward-only. Existing nodes simply have no snapshot.
- **Permissions:** on update, Firefox grants `scripting` and `idle` without a prompt. `<all_urls>` stays ungranted until the next session start or the popup's button.
- **Rollback:** none. Downgrading the extension would meet a version-7 database, as with every earlier migration.

## Findings

- **The e2e suite grants page access itself.** It submits the popup's form from a script, and Firefox refuses `permissions.request` without a user gesture. `e2e/fixtures/firefoxExtension/grantPageAccess` therefore grants `<all_urls>` through `ExtensionPermissions`, as the user's "Allow" would. That exercises the "access granted later" path: `permissions.onAdded` injects into the already-open article without a reload. The popup's own request (made before `tabGroup.create`, skipped once granted, and not blocking the start) is covered by its unit tests only. A manual check in `npm run dev` should confirm that the prompt appears on the first session start.
- **Headless Firefox reports its window focused.** Active dwell is recorded in the e2e run without any focus workaround.
- **Bundles stay apart.** `content-scripts/pageObserver.js` is 46 kB, carrying Readability and valibot but no `idb`. `background.js` does not contain Readability. The manifest has no `content_scripts` entry.
- **REQ-CAP-005's 1 ms p95 is not measured yet** (task 9.4). The structure is unit-tested: a scroll event only sets a flag and asks for one frame, and a copy only increments a counter.
