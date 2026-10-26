# Design

## Context

Everything stored already knows its session: nodes, edges, snapshots, vectors, jobs and clusters carry a `sessionId`, and a session carries the `groupId` of its tab group. What makes the extension single-session is **lookup**, not storage. About 29 call sites ask `getActiveSession(database)` — `database.getFromIndex(SESSION_STORE, "status", "active")`, which returns _the_ session — and the rest go through `getLiveSession`, `assertNoActiveSession`, `reconcileActiveSession`, or the same index. Tab events (`followTabMembership`, `recordNavigation`, `closeTabNode`, `trackActiveDwell`, `updateTabTitle`, `recordTabFocus`) resolve their session that way, as do the AI enqueuers, the map, recorded and summaries readers, and `startSession`/`resumeSession`, which refuse when it is set.

Constraints that stay: the background registers every listener synchronously and is the only context that writes storage; surfaces ask it over RPC; a session is a Firefox tab group, and groups do not survive a restart by id unless Firefox restores them (the session follows its group, and a closed session waits for it to return).

## Goals / Non-Goals

**Goals:**

- Any number of sessions record at once, each from its own group, with no cross-talk.
- The popup's select only chooses the viewed session; map, recorded and summaries pages are pinned to a session.
- A single place decides "which session does this tab or group belong to", so no module re-implements it.
- No storage migration.

**Non-Goals:**

- Moving a tab between sessions as a first-class action (dragging it between groups already works as "left one, joined the other").
- Cross-session analysis (shared clusters, comparing sessions).
- A session picker inside the map page.

## Decisions

### 1. Resolve a session by group, through one module

Replace the single-session lookups with a small set in `researchSession`:

- `listLiveSessions(db)` — every `active` and `closed` session (`getAll` on the `status` index twice; there are few).
- `getSessionForGroup(db, groupId)` — the live session whose `groupId` matches, or whose `formerGroupIds` contains it (the existing "returning former group" rule).
- `getSessionForTab(db, tab)` — `getSessionForGroup(db, tab.groupId)`, and for a tab no longer in a group (a removal), the session holding a node for that `tabId` in a non-closed state.

`getActiveSession` and `assertNoActiveSession` are deleted, not kept as "the first one", so a stale caller is a compile error rather than a silent single-session bug. `getLiveSession` goes the same way. Each caller then either takes a `sessionId` it already has (queue jobs, pages), or resolves one from its event (tab events).

_Alternative: keep `getActiveSession` returning the viewed session._ It compiles everywhere and would be wrong everywhere: capture would record into whichever session the user happened to be looking at. Rejected.

_Alternative: add a `groupId` index._ The sessions store is tiny; a scan costs less than a forward-only migration. Revisit if sessions reach the hundreds.

### 2. Tab events pick the session from the tab's group

`followTabMembership` already compares `tab.groupId` with a session's group. It becomes: resolve the session the tab now belongs to _and_ the one it left (a node for this `tabId` in another live session), close that node, record into the new one. This is the one non-mechanical rewrite in capture. `recordNavigation`, `closeTabNode`, `updateTabTitle`, `recordTabFocus` and dwell tracking resolve through `getSessionForTab`; a tab in no session group is ignored exactly as today.

Dwell and focus are per session already (`session.focus`, `session.recentSwitches` live on the session record). Switching focus between a tab of session A and one of session B closes A's visit and opens B's; each session keeps its own `focus`. Co-attention counts only switches inside one session.

### 3. Statuses mean what they say, and several may share one

`active`: its group exists. `closed`: its group is gone and may return. `saved`: ended, resumable from the library. Nothing makes one of them unique any more:

- `startSession` no longer reconciles-and-refuses, and no longer ends the closed session. A closed session stays closed, waiting for its group, until it is resumed, deleted or its group returns.
- `reconcileActiveSession` becomes `reconcileSessions`: for every live session, close the ones whose group is gone, reopen closed ones whose group is back, take over renamed titles. It runs at start-up and whenever a surface asks, as today.
- `createSession`'s transactional "is one already active" check is removed. The "two starts at once" guarantee becomes "each start writes its own session or leaves nothing", which the transaction already gives.
- `resumeSession` loses its refusal and its "end the other closed session" write; it only needs the session to be `saved` or `closed` and not already live. Resuming a `closed` session whose group is still alive is refused (it would duplicate tabs) and told to reopen the group.

`closeSessionForGroup` and `reopenSessionForGroup` already key on the group id; they stop assuming a single index entry.

### 4. The viewed session is background state, stored beside the other settings

One field, `viewedAt`, on the stored session: choosing a session stamps it with the time, and the active session with the greatest value is the viewed one. The background answers `session.getActive` with `{ sessions: SessionSummary[], viewedId }` (live first, then saved, as the popup lists them) and accepts `session.view { sessionId }`. Resolution when no active session has the field: the live session whose group holds the selected tab, else the most recently updated live session, else none. Start and resume stamp it. A session that is closed or deleted stops counting, so no key can go stale.

The popup keeps no copy of the choice: it renders what the background said and asks to change it. That keeps the popup, which closes freely, from being the owner of state.

_Alternative: remember the choice in the popup (`sessionStorage`)._ Lost on every close, and the pages could not follow it.

### 5. Pages are pinned by a query parameter

`map.html?session=<id>`, `recorded.html?session=<id>`, `summaries.html?session=<id>`. `openMap`/`openRecorded`/`openSummaries` take an optional `sessionId`; the background looks for an open tab at the _same URL_ before opening one, which gives "same page, same session → select it; other session → new tab" with no extra bookkeeping. A page opened with no parameter follows the viewed session through the existing live-data topics (`data changed` with a `viewed` topic).

Each page puts the session's title in its heading and `document.title`, so two tabs are told apart. A page whose session was deleted says so rather than falling back to another, because a pinned page that silently changes subject is worse than one that says it is empty.

The graph subscription message `graph.subscribe` gains `sessionId`; the background pushes snapshots of that session only and re-pushes when a node of it changes. Today it pushes "the" graph; it becomes one subscription per session per port.

### 6. AI work follows the node's session

Jobs already store `sessionId` in their payload where the work is per session; the _enqueuers_ (`enqueueSnapshotEmbeddings`, `enqueueFactExtractions`, `enqueueEntityResolutions`, `enqueueClusterSummaries`, `enqueueOpenQuestions`, `reclusterActiveSession`) are the ones that read "the active session". They change to take a `sessionId`, supplied by the capture step that created the node, or run once per live session when triggered from outside capture. The queue itself is unchanged: one worker, jobs in priority order, so two sessions share the model fairly in arrival order. `activeEmbeddingSpaceId` is per session already, so sessions may use different embedding spaces.

The AI activity strip counts the queue as a whole, which stays correct.

### 7. Popup

The select lists live sessions first (the viewed one chosen), then a divider and the saved ones. Choosing a live session calls `session.view`. Choosing a saved one shows its card with **Resume** and **Delete** side by side (the `⋯` menu and the switch warning are removed). `＋` is always enabled and opens the title form. The panel is 26rem (416 px) so the select, `＋`, and the card's buttons fit on one row.

`switchSession`, its tests, the `Switch` / `Close current and switch` buttons and the `switch-*` test ids are deleted. `session.resume` no longer closes anything.

## Risks / Trade-offs

- [A tab event is routed to the wrong session] → one resolver (`getSessionForTab`), exhaustive unit tests with two sessions, and an e2e that reads in two groups at once and checks the graphs do not mix (REQ in `research-graph`: _Graphs do not mix_).
- [A stale single-session call site compiles and misbehaves] → delete `getActiveSession`/`getLiveSession`/`assertNoActiveSession` rather than redefine them, so the compiler lists every call site.
- [Two sessions fight over one tab when a group is restored] → the `formerGroupIds` merge rule already handles one session; it is checked per session, and a group id belongs to at most one session (asserted on start and resume).
- [The queue starves one session] → jobs are served in arrival order within a priority, so a large session delays but does not block the other; revisit if it shows in practice.
- [Firefox restores one of two groups after a restart] → each session reconciles on its own group; the other stays `closed` until its group returns or the user resumes it.
- [The background is unloaded while two sessions record] → all state is already in IndexedDB per session; the only new in-memory state would be per-session focus, which lives on the session record.

## Migration Plan

No data migration: existing databases hold at most one `active` and one `closed` session, which is a valid state of the new model. Ship the lookups and the reconcile first behind unchanged single-session behaviour (tests green with one session), then lift the refusals in start and resume, then the surfaces. The viewed-session key is absent on first run and resolves by rule 4. Rollback is reverting the change; a database written with two active sessions would then show only one of them, and the other would be closed by the old reconcile, not lost.

## Open Questions

- Whether a session's group colour should be set by the extension so the user can tell sessions apart in the tab strip (Firefox picks one today). Does not change the specs or tasks.
