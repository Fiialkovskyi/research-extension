# Proposal

## Why

The graph records where the user went but not what they did on a page. Without in-page signals,
every node looks the same: a page read closely and a page abandoned after a glance are
indistinguishable, and nothing downstream (clustering, embeddings, synthesis) has the text of the
pages that mattered. This change adds the engagement half of capture: active reading time, revisits, scroll depth, copy
events, the engagement state derived from them, and the readable text of a page once it is deep
read.

## What Changes

- A content script, injected only into the active session's tabs, observes scroll depth (passive,
  one measurement per animation frame) and copy events (their count only; the clipboard and the
  selection are never read). It batches what it saw and flushes at most every 2 s, when the page is
  hidden, and on `pagehide` (REQ-CAP-005).
- The background measures active reading time per node: time counts only while the node's tab is
  the selected tab of the focused Firefox window and the user is not idle (60 s without input),
  following the target spec's "Focus and active time" source. A return to a page that was read
  before, lasting 20 s or more, counts as a revisit. The open interval is kept in the database, so an
  unloaded event page loses no time.
- The background folds each batch into the node the tab currently shows, through the existing
  signal merge. A batch from a tab that is not a session tab, or whose page is no longer the node's
  page, is dropped; the first one tells the script to stop.
- The node's engagement state (`unread`, `skimmed`, `deep_read`, `dead_end`) is derived from its
  signals by a versioned rule set, `engagement_rules@1`, and never stored. The rule set is the target
  spec's table except its "return to the SERP within 10 s" clause, which is left for later.
- When a node first reaches deep read while its page is open, the background asks its tab's script
  for the page text. The
  script extracts it with Mozilla Readability, truncates it to 200 KB and says whether it did; the
  background hashes it (SHA-256), compresses it and stores it as the node's snapshot, once per node
  (REQ-CAP-006).
- Starting a session asks for access to page contents (`<all_urls>`) from the popup's own click
  (REQ-RT-002). If it is refused, capture continues without in-page signals, and the popup says so
  and offers to ask again.
- The research map shows each page's engagement state in words and by a marker, so colour is not
  its only carrier (REQ-UI-002).
- The manifest gains the `scripting` and `idle` permissions and `<all_urls>` as an optional host
  permission.
- New dependency: `@mozilla/readability`, bundled into the content script only.

## Capabilities

### New Capabilities

- `page-signals`: the engagement signals of a session page and how they reach the graph — active
  reading time and revisits, in-page observation in session tabs only, batching and flushing,
  attribution to the tab's current node, the engagement rule set, and behaviour without page access.
- `page-snapshots`: extracting a deep-read page's readable text once, truncating, hashing and storing
  it compressed against its node.

### Modified Capabilities

- `research-session`: starting a session also asks for page access; the popup shows when page access
  is missing and can ask again.
- `research-map`: a drawn page carries its engagement state.
- `extension-shell`: the declared permissions grow by `scripting`, `idle` and an optional
  `<all_urls>` host permission.

## Impact

- **New code:** a content script entrypoint (wiring only), a `features/pageSignals/` feature
  (batching, rules, injection), a `features/pageSnapshots/` feature (extraction, storage).
- **Changed code:** `app/backgroundApp` (a content-script message path that knows the sending tab),
  `entrypoints/background` (`runtime.onMessage` sender, `permissions.onAdded`,
  `windows.onFocusChanged`, `idle.onStateChanged`), the popup's start flow, `researchMap` (snapshot
  and node), `tabCapture` (active dwell).
- **Storage:** database version 7 adds a `snapshots` store; nodes gain `contentHash` and
  `snapshotId`; the session keeps its open focus interval.
- **Privacy:** page text is stored locally, compressed but **not yet encrypted** (REQ-SEC-005 is a
  later change), and there is **no denylist yet** (REQ-SEC-007): until it lands, a deep-read banking
  or webmail page in the session group would be snapshotted. Both are called out in the design as
  gaps to close before real use.
- **Target spec:** active reading time gets a numbered requirement of its own (REQ-CAP-010); until
  now it lived only in the event-source table.
