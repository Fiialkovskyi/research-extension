# Design

## Context

- The database is at version 5. `researchGraph` offers:
  - `recordNode`, `closeNode`, `addNodeSignals`, `recordEdge`, `readTabNode` (the newest open node of a tab) and `readSessionGraph`;
  - nodes carry `tabId`, and a closed node is never returned for a tab.
- `researchSession` keeps one active session with its `groupId`. Its listeners for group renames and removals, and `runtime.onStartup`, already exist in the background entrypoint.
- From the tab groups spike Findings:
  - without `tabs`, a `Tab` has `groupId`, `openerTabId` and `active`, but no `url` or `title`;
  - a tab opened from a grouped tab joins the group by itself, and `tabs.onCreated` already reports the opener's `groupId`;
  - membership changes fire `tabs.onUpdated` with `groupId`.
- The background is an event page: every listener is registered synchronously, and nothing about capture may live only in memory.

## Goals / Non-Goals

**Goals:**

- Every web page read in the session's group is a node, with its parent and opener links.
- The graph stays correct across event-page unloads and a browser restart.
- The user can see that capture works (page count in the popup).

**Non-Goals:** SERP detection, dwell, content scripts, denylist, SPA navigations, co-attention.

## Decisions

### Permissions: `tabs` and `webNavigation` at install

The alternative is the target spec's optional `<all_urls>` host permission, requested at the first session start, with a degraded mode when it is refused (REQ-RT-002). That needs a permission flow, a degraded path and tests for both. The installed permissions are simpler and enough for the MVP. Content scripts will need host permissions later, and REQ-RT-002 applies then.

The extension-shell requirement that forbade `tabs` is modified, not removed: the manifest still declares exactly what the surfaces use, and still adds no network access.

### What creates a node

A node is created on `webNavigation.onCommitted` when all of these hold:

- `frameId === 0`;
- the tab (`tabs.get`) is in the active session's group and is not `incognito`;
- the URL is `http:` or `https:` (`isCapturableUrl`). This excludes `about:`, `moz-extension:`, `file:` and `data:` (CAP-008);
- `transitionType !== "reload"`.

Fragment changes arrive on `onReferenceFragmentUpdated`, which is not subscribed, so they create nothing (CAP-002).

`onCommitted` is used rather than `tabs.onUpdated` with `url`, because only it reports the transition type that the node stores.

### Links

- **Parent:** the tab's current open node (`readTabNode`). The new node's `parentNodeId` points to it, a `sameTab` edge is recorded, and the parent is closed. So `open` means "shown in a tab right now", and each tab has at most one open node.
- **Opener:** only for a tab's first node. If the tab's `openerTabId` has an open node in the session, it becomes `openerNodeId`, with an `opener` edge.
- **Edge weights** follow the target spec's `cluster_config@1` defaults (`opener` 1.0, `sameTab` 0.5), kept in `tabCapture/constants.ts`.

### Membership

| Event                                                   | Effect                                                                                                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tabs.onUpdated`, `groupId` becomes the session's group | If the tab has no open node and its URL is capturable: record a node from `tab.url`/`tab.title`, `transitionType: "joined"`, with an opener link if any. |
| `tabs.onUpdated`, `groupId` leaves the session's group  | Close the tab's open node.                                                                                                                               |
| `tabs.onRemoved`, `isWindowClosing: false`              | Close the tab's open node.                                                                                                                               |
| `tabs.onRemoved`, `isWindowClosing: true`               | Nothing; start-up reconciliation decides.                                                                                                                |

A tab created already inside the group (opened from a grouped tab) needs no join handling: its first commit records it.

### Titles

At commit `tab.title` is usually still the previous page's. The node is recorded with the title known then, and `tabs.onUpdated` with a `title` change updates the tab's open node (`researchGraph.updateNodeTitle`). A blank title is ignored.

### Focus

`tabs.onActivated` → if the tab has an open node in the session, `addNodeSignals(focusCount: 1, lastFocusedAt: now)`. Revisits and dwell need idle and window focus and are left for the dwell change.

### Order of events

The browser can deliver `onCommitted`, `onUpdated` (title) and `onActivated` for one tab within milliseconds, and each handler awaits the database. To keep writes in arrival order, the background app chains capture handlers on one promise. A failed handler is logged with `console.error` and does not break the chain. Each handler reads the active session itself (`getActiveSession`, an index read), so the queue holds no session state that an unload could lose.

### Reconciliation after a restart

On `runtime.onStartup`, after `reconcileActiveSession`, `reconcileSessionTabs`:

1. queries the tabs of the session's group;
2. closes every open node of the session for which no group tab has the same `tabId` and `url`;
3. records a node (`transitionType: "restored"`) for each capturable group tab that has no open node.

Tab ids are not stable across a restart, which is why a match needs both `tabId` and `url`.

### Browser surface

`TabCaptureApi { getTab(tabId), queryGroupTabs(groupId) }`, plus the event payloads as plain objects. These are structural, as with `TabGroupApi`, so every rule above is unit tested without a browser. The entrypoint passes `browser.tabs.get` and `browser.tabs.query({ groupId })`.

### Popup count

`session.active`'s summary gains `pageCount` (`researchGraph.countSessionNodes`, a count on the `sessionId` index). The popup shows `Session "X" is active · N pages recorded` (`data-testid="session-page-count"`).

### End-to-end pages

The suite stays offline. `wdio.conf.ts` starts a static server on `127.0.0.1` in `onPrepare`, serving `e2e/fixtures/pages/`, and stops it in `onComplete`. A chrome-context fixture loads a URL into the selected tab (`gBrowser.selectedBrowser`, with the system principal), because the session's tab is not a browsing context the content-side driver selected.

## Risks / Trade-offs

- **Restored tabs start new chains.** After a restart a restored tab gets a new node with no parent; its pre-restart node was closed. → Acceptable for the MVP. Later, a closed-at-shutdown node with the same URL can be linked as the parent.
- **SPA navigations are invisible** until `onHistoryStateUpdated` is handled. → Listed as a follow-up.
- **Permission prompt on update** for existing installs. → Expected; the extension is not published yet.
- **The serial queue delays a burst of events.** → The handlers are a few IndexedDB operations each; NFR-001 (1 s p95) leaves ample room.

## Open Questions

- Whether a navigation committed before `tabs.get` reports the new `groupId` can be missed for a tab created from a grouped tab. The spike saw `onCreated` already carrying the `groupId`, so it is expected not to; the e2e opener scenario checks it by hand during apply.
