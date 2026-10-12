# Tasks

## 1. Engagement rules

- [x] 1.1 Add `src/shared/config/engagementRules/` with the version `engagement_rules@1` and every threshold from design.md, and export it from the config barrel. Verify that `npm run typecheck` passes.
- [x] 1.2 Add `researchGraph/model/getNodeEngagement(node, { isFocused })` and export it from the barrel. Its spec covers:
  - `unread` at `focusCount` 0;
  - `deep_read` from one copy, from dwell plus scroll, and from 2 revisits;
  - `dead_end` only when not focused;
  - `skimmed` for a focused short glance;
  - the threshold boundaries.

## 2. Storage version 7

- [x] 2.1 Add `StoredSnapshot`, `SNAPSHOT_STORE`, the optional `snapshotId` and `contentHash` on `StoredNode`, and the optional `focus` visit on `StoredSession`. Raise `DATABASE_VERSION` to 7, with a step that creates the store. Extend the `applyDatabaseUpgrade` spec:
  - a fresh profile reaches version 7;
  - a version-6 profile with nodes reaches it with those nodes unchanged.

## 3. Active dwell and revisits

- [x] 3.1 Add `tabCapture/model/trackActiveDwell` from design.md. Its fake-indexeddb spec covers:
  - an interval is added on a switch;
  - an unfocused window or no target adds nothing and keeps the visit;
  - resuming the same node continues the visit;
  - the 10-minute cap;
  - a revisit counted once at 20 s;
  - a first visit never counted as a revisit;
  - a tab outside the session gets nothing;
  - with no session, nothing is written;
  - `discardOpen` drops a stale interval.

## 4. Snapshots

- [x] 4.1 Add `pageSnapshots/model/recordSnapshot` and its helpers (SHA-256 hex, gzip), plus `readSnapshotCandidate`. The fake-indexeddb specs cover:
  - the snapshot is stored, and the node gets `snapshotId` and `contentHash`;
  - a second call for the same node stores nothing;
  - identical text gives the same hash;
  - empty text is refused;
  - the stored bytes gunzip back to the text;
  - the candidate rules: open, `deep_read`, no snapshot.
- [x] 4.2 Add `pageSnapshots/model/extractReadableText` with `@mozilla/readability` (add the dependency). It works on a clone of the document and truncates to 200 KB of UTF-8 on a character boundary. Its jsdom spec covers:
  - an article page;
  - a page with no readable content;
  - 300 KB that comes back truncated;
  - a page document that is unchanged.

  The barrel must not export it, and carries a comment saying why.

## 5. In-page observer

- [x] 5.1 Add the content message schemas (`signal.batch`, `content.extracted`), the background-to-page `content.extract`, and their replies, in `pageSignals/schemas.ts`. Keep them out of `requestSchemas`, and verify with a spec that `handleMessage` refuses `signal.batch` as `unknown-type`.
- [x] 5.2 Add `pageSignals/model/observePage`, with injected `window`, `document`, `send`, `onRequest`, `requestFrame`, timers and `extract`. Its jsdom spec uses fake timers and covers:
  - one measurement per frame for a scroll burst;
  - a batch at most every 2 s;
  - an immediate send on hidden and on `pagehide`;
  - no batch when nothing changed;
  - untrusted copies ignored;
  - copy deltas reset after each send;
  - `stop: true` detaching every listener;
  - `content.extract` extracting and sending once per document;
  - a second injection being a no-op.

  The barrel must not export it.

- [x] 5.3 Add the content script `src/entrypoints/pageObserver.content/index.ts` with `registration: "runtime"`, as wiring only. Verify that `npm run build:firefox`:
  - emits `content-scripts/pageObserver.js`;
  - adds no manifest `content_scripts` entry;
  - leaves Readability out of the background bundle.

## 6. Background wiring

- [x] 6.1 Add `pageSignals/model/readSignalTarget`, the attribution rules from design.md: the current node, the just-replaced parent, a stale page dropped, and no session tab meaning `stop`. Add a spec for it.
- [x] 6.2 Add `pageSignals/model/recordSignalBatch`, which attributes a batch and merges it, with a spec covering a scroll maximum, copies that add up, and drop replies.
- [x] 6.3 Add `pageSignals/model/injectPageObserver` and `injectSessionTabs`, which run frame 0 through injected `executeScript` and swallow failures. Add specs.
- [x] 6.4 Wire `app/backgroundApp`:
  - `handleContentMessage(message, sender)`;
  - injection after commits, membership changes, restores and reconciliation;
  - `handlePermissionsAdded`, `handleWindowFocusChanged` and `handleIdleStateChanged`;
  - dwell tracking after each focus-relevant event, and dropped at start-up reconciliation;
  - snapshot requests for deep-read candidates;
  - the `engagement` the map push carries.

  Add the new dependencies to `types.ts`. Extend `index.spec.ts`:
  - a batch updates its node;
  - an unknown tab answers `stop`;
  - a commit injects inside the group and not outside it;
  - access granted injects into the session tabs;
  - switching tabs records dwell on the previous node;
  - a copy that makes a page deep read sends `content.extract`, and `content.extracted` stores a snapshot.

- [x] 6.5 Wire `src/entrypoints/background`:
  - `runtime.onMessage` routing by sender;
  - `permissions.onAdded`, `windows.onFocusChanged` and `idle.onStateChanged`, each registered synchronously;
  - `idle.setDetectionInterval(60)`;
  - the real `readFocusedTab`, `executeScript` and `requestPageText`.

  Verify with `npm run typecheck`.

## 7. Permissions and popup

- [x] 7.1 Manifest: add `scripting` and `idle` to `permissions` and `optional_host_permissions: ["<all_urls>"]`, and update the comment. Verify that the built manifest's permission lists match the `extension-shell` delta, and update any check that asserts them.
- [x] 7.2 Popup:
  - read `permissions.contains` on mount;
  - on submit without access, call `permissions.request` synchronously before sending `tabGroup.create`, without waiting for its answer;
  - for an active session without access, show the notice and an "Allow page access" button.

  The component specs cover:
  - the order of the request and the create message;
  - no request when access is already granted;
  - the create message still sent when the request rejects;
  - the notice shown only without access.

## 8. Map

- [x] 8.1 Add `engagement` to `mapNodeSchema`, derived in `buildGraphSnapshot` with the session's focus. Update its spec.
- [x] 8.2 Pass `engagement` through `buildMapLayout`. `MapPageNode` renders the shape marker and the state in words, and sets `data-engagement`. Its spec covers all four states and markers that differ by shape.

## 9. End-to-end and documentation

- [x] 9.1 Fixtures:
  - auto-grant optional permissions in `buildProfilePreferences`;
  - serve `article.html`;
  - add helpers to scroll a tab's page and to copy a selection with a real key chord;
  - add readers for node `signals`, `contentHash`, the `snapshots` store and map `engagement`.

  Every helper that carries logic has its own spec.

- [x] 9.2 Add `e2e/specs/pageSignals.e2e.ts`:
  1. Scrolling `article.html` records `maxScroll ≥ 0.9`.
  2. After a short read, switching to another session tab records active dwell > 0 on the article.
  3. Copying from it gives 1 copy event, one snapshot with a `contentHash` and the article text, and `deep read` on the map within a second.
  4. A page outside the group gets no node.

  Verify that `npm run test:e2e` passes.

- [x] 9.3 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`:
  - add REQ-CAP-010 for active reading time and revisits;
  - REQ-RT-003 says injection is per session tab;
  - REQ-CAP-006 says the hash is computed in the background;
  - note that the engagement table's return-to-SERP clause is not yet in `engagement_rules@1`;
  - the M1 checklist line names CAP-010.

  Verify that `openspec validate add-engagement-signals --strict` passes.

- [ ] 9.4 Measure handler cost on `article.html` with the Firefox Profiler in a dev build, and record the p95 per scroll and copy event under Findings in design.md.
- [x] 9.5 Run `npm run verify` and confirm that it passes.
