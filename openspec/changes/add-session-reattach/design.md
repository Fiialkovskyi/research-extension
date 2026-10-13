# Design

## Context

- **Roots.** `researchGraph/readSessionRoot(database, sessionId)` returns a session's earliest SERP, with its `query`. `tabCapture/recordNavigation` records SERPs with `kind: "serp"` and `query`, and calls `linkRefinement` for later ones.
- **Saved sessions** are `status: "saved"`, listed by `listSavedSessions`.
- **Embeddings.** The background loads the active embedding model through `loadEmbeddingSession(model)`, whose `embed(texts, role)` applies the model's role prefixes. `snapshotEmbeddings/compareVectors` compares two vectors of one space.
- **Session-scoped stores** are indexed by `sessionId`: nodes, edges, snapshots, chunks, vectors and jobs (database version 12). `recordedData/deleteSession` already walks them.
- **The popup** reads the active session's summary from `session.active`.

## Goals / Non-Goals

**Goals:**

- The term match works without a model; the embedding match is added when one is active.
- Reattaching is one transaction: either both sessions are as before, or one session holds everything.

**Non-Goals:** several candidates, matching beyond the root query, and reopening old tabs.

## Decisions

### Terms

`researchLibrary/model/findReattachCandidate/utils/readQueryTerms(query) → Set<string>`:

- it lowercases the query and splits on whitespace and on punctuation other than a hyphen between letters or digits, so `e-bike` stays one term;
- it drops terms of one character and a short English stop list (`the`, `a`, `an`, `of`, `for`, `and`, `or`, `in`, `on`, `to`, `with`, `vs`, `how`, `what`, `best`).

Overlap is Jaccard: shared over the union. It is symmetric and stricter than the share of either side.

### Finding a candidate

`findReattachCandidate({ database, session, embedQueries? }) → { sessionId, title, reason: "terms" | "meaning", score } | undefined`:

1. It reads the new session's root, and returns nothing without one.
2. It reads every saved session's root query.
3. It scores each by terms.
4. If `embedQueries` is given, it embeds `[newQuery, ...savedQueries]` in one call with role `query`, and scores each by cosine, comparing through `compareVectors` under one synthetic space id. All the vectors come from one model in one call.
5. It keeps candidates with terms ≥ 0.6 or cosine ≥ 0.8, and picks the highest score, preferring meaning over terms when both qualify.

### When it runs

After `handleNavigationCommitted` records a node, the background checks whether that node is the session's root. That is the case when `readSessionRoot` returns this node and the session has neither `reattachSuggestion` nor `reattachDeclined`.

The check runs **off** the capture queue, because embedding takes seconds. Only the final write of `reattachSuggestion` runs on the queue, re-checking that the session is still active and undecided. The graph push then refreshes nothing visible, but the popup reads the suggestion on its next open.

### Continuing

`researchLibrary/model/reattachSession({ database, activeSessionId, savedSessionId, now })` runs one `readwrite` transaction over sessions, nodes, edges, snapshots, chunks, vectors, jobs and clusterings:

1. It checks that the active session is active and the saved one saved.
2. For each session-scoped store, it reads the active session's records by the `sessionId` index and puts each back with the saved session's id.
3. It deletes the active session's clustering.
4. It puts the saved session with:
   - `status: "active"`;
   - `groupId` of the current session, with the saved session's former `groupId` appended to `formerGroupIds`;
   - `focus` and `recentSwitches` from the current session;
   - `lastPosition`, `reattachSuggestion` and `savedTabs` removed;
   - `updatedAt`.
5. It deletes the active session record.

**After the transaction**, the background:

- renames the group to the saved session's title through `tabGroups.updateGroup`;
- calls `linkRefinement` for every SERP moved in, now that they share a root;
- reschedules clustering, and pushes the graph.

Job identities do not include the session, so a moved job keeps its identity and its result, and only its `sessionId` field changes.

### Declining

`declineReattach(database, sessionId)` sets `reattachDeclined: true` and removes `reattachSuggestion`.

### Messages and popup

- **Messages.**
  - The `session.active` summary gains `reattachSuggestion: { sessionId, title } | undefined`.
  - `session.reattach { savedSessionId }` answers `session.reattached`.
  - `session.keepSeparate {}` answers `session.keptSeparate`.
- **Popup.** It shows the offer under the active session, and after either answer reads the session again.

## Risks / Trade-offs

- **[A false match on a common term]** → Jaccard at 0.6 needs most terms shared. The user decides, and declining is final for the session.
- **[Embedding queries costs a model load]** → It happens once per session, only when a model is active, off the capture queue.
- **[Moving many records in one transaction]** → A new session at its first search holds a handful of records.

## Migration Plan

None: the new session fields are optional.
