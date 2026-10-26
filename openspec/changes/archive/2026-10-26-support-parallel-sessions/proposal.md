# Proposal

## Why

The extension records exactly one research session at a time, because the first version was scoped to a single tab group. Real research runs on several threads at once, and today starting or resuming one means closing the other. The popup's session select cannot be what the user expects it to be — a way to say _which session I am looking at_ — while choosing a session also decides which one is recorded. Splitting those two ideas is what makes a select with several sessions make sense.

## What Changes

- **BREAKING** Several sessions can be active at once, each following its own Firefox tab group. Starting a session no longer refuses while another is active, and no longer ends a closed one. Resuming a saved session no longer refuses while another is active.
- Capture follows the tab's group, not "the" active session: a tab belongs to the session whose group it is in, and a tab outside every session group is ignored as before.
- The popup's session select only chooses the **viewed session**: the one the popup, the map, "What was recorded" and the summaries refer to. Choosing a session closes nothing and records nothing differently. The choice is remembered by the background, so it survives the popup closing.
- The select lists the sessions that are live (active or closed with a group that may return) first, then the saved ones. A saved session shows a **Resume** button, with no warning, because resuming no longer closes another session. The `+` button is always available.
- The map, "What was recorded" and summaries pages open for one session and say which. A page opened from the popup is pinned to the viewed session at that moment, so two maps for two sessions can be open side by side; a page opened without a session follows the viewed one.
- Background AI work (embeddings, facts, clusters, summaries, open questions, entity resolution) is queued for the session a node belongs to, not for the active one, and runs for every live session.
- The one-at-a-time **Switch** flow added earlier (`switchSession`, its warning, and the `Close current and switch` button) is removed; resuming opens the session beside the others.
- The popup panel is 416 px wide and every control is visible: the `⋯` menu is gone, and Delete sits beside Resume.

## Capabilities

### New Capabilities

- `viewed-session`: which session the extension's surfaces refer to — the remembered choice, its default when nothing was chosen, what happens when the viewed session ends, and how a page is pinned to one session.

### Modified Capabilities

- `research-session`: more than one session may be active; starting no longer refuses or ends a closed session; the popup shows the viewed session and a select over all sessions.
- `research-library`: resuming no longer refuses while another session is active and no longer ends a closed one.
- `research-map`: the map draws one chosen session's graph, not "the active" one; the popup opens the map for the viewed session.
- `recorded-data`: "What was recorded" shows the chosen session, active, closed or saved.

## Impact

- **Storage:** no schema change is needed. Sessions already carry a `groupId` and every node, edge, snapshot, vector and job carries its `sessionId`. The `status` index stops being treated as unique (`index.get("active")` becomes `getAll`). The viewed session id is one new key in the background-owned settings.
- **Code:** about 40 modules read "the active session" (`getActiveSession`, `getLiveSession`, `assertNoActiveSession`, the `status` index): `researchSession`, `tabCapture`, `pageSignals`, `researchLibrary`, `recordedData`, `researchClusters`, `clusterSummaries`, `openQuestions`, `factExtraction`, `entityResolution`, `snapshotEmbeddings`, `comparisonTable`, `researchGaps`, and the background composition root. The popup, map, recorded and summaries apps gain a session parameter.
- **RPC:** `session.getActive` becomes a listing of sessions plus the viewed one; new `session.view`; page-opening requests carry a session id. Responses stay backward-compatible within the extension, since every surface ships together.
- **Docs:** this amends `REQ-CAP-004` and `REQ-RT-001` in `RESEARCH_GRAPH_EXTENSION_SPEC.md`, and supersedes the _Several sessions at once_ entry in `docs/BACKLOG.md`.
- **Out of scope:** merging sessions, moving a tab between sessions as a user action, and a session picker inside the map page (the page is pinned from the popup).
