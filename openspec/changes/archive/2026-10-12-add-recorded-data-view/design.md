# Design

## Context

- **Session-scoped stores today.**
  - `nodes` and `edges` have a `sessionId` index.
  - `snapshots`, `chunks` and `vectors` carry `sessionId` but have no index on it. `chunks` is indexed by `snapshotId`.
  - `vectors` is keyed `[spaceId, chunkId, part]` and carries `nodeId`.
  - `jobs` carry an optional `sessionId`, and an embedding job's `payload.snapshotId`.
  - `clusterings` is keyed by `sessionId`.
- **Reading.** `getLiveSession` returns the active or closed session. `pageSnapshots/readSnapshotText` decrypts a snapshot.
- **The map page** is opened by `researchMap/openMapTab(api, url)`, which reuses an open tab and ungroups a new one. It is written for any URL.
- **The popup** talks to the background through one-shot `client.request`. Pages with live data use a port.
- **Tab restore** (`restoreSessionTab`) ignores a tab marked with a session that no longer exists.

## Goals / Non-Goals

**Goals:**

- One transaction per cascade, so a deletion is all or nothing.
- Read paths that touch only the deleted session's or node's records.
- Destructive controls that cannot fire by accident.

**Non-Goals:**

- Saved sessions in the view (the M3 library), and undo after the fact.
- Deleting signals separately from their node.

## Decisions

### Storage version 12: indexes for the cascades

| Store       | New indexes           |
| ----------- | --------------------- |
| `snapshots` | `sessionId`           |
| `chunks`    | `sessionId`           |
| `vectors`   | `sessionId`, `nodeId` |
| `jobs`      | `sessionId`           |

Every existing record already carries the indexed field (or omits `sessionId` on a job, which an index simply skips), so the step only creates indexes.

### `features/recordedData`

- **`model/readRecordedSession(database) → RecordedSession | undefined`.** For the live session, it returns the session's title and status, and per node:

  ```ts
  { id, title, url, domain, kind, tabState, createdAt, signals,
    snapshot: { byteLength, truncated, capturedAt } | null,
    vectorCount }
  ```

  It reads nodes by `sessionId`, snapshots by id, and counts vectors through the new `nodeId` index. Text is not included.

- **`model/readRecordedText(database, nodeId)`.** The node's snapshot text through `readSnapshotText`, or `null`. Only nodes of the live session are served.
- **`model/deleteNode(database, nodeId)`.** One `readwrite` transaction over nodes, edges, snapshots, chunks, vectors and jobs:
  1. the node;
  2. edges of its session whose `from` or `to` is the node (read by the `sessionId` index and filtered);
  3. its snapshot;
  4. chunks by `snapshotId`;
  5. vectors by `nodeId`;
  6. jobs of the session whose `payload.snapshotId` is the snapshot.

  It returns whether the node existed.

- **`model/deleteSession(database, sessionId)`.** One `readwrite` transaction over every session-scoped store:
  - deletes every record found by each store's `sessionId` index;
  - deletes the clustering by key;
  - deletes the session record last.

  Spaces stay: they are shared definitions, not session data.

- **`ui/recordedPage`** is the list, and **`ui/confirmDelete`** is a button that becomes "Delete … ? / Cancel" on first press and calls `onConfirm` only on the second. Both are imported by path by the app.

### Messages

| Request             | Answer                                  |
| ------------------- | --------------------------------------- |
| `recorded.read`     | `recorded.session` (or `session: null`) |
| `recorded.readText` | `recorded.text`                         |
| `node.delete`       | `node.deleted`                          |
| `session.delete`    | `session.deleted`                       |
| `recorded.open`     | `recorded.opened`                       |

The schemas live in `recordedData/schemas.ts` and merge into `requestSchemas`.

`node.delete` and `session.delete` run on the capture queue, so they cannot interleave with a capture write. After them, the background pushes the graph, and reclusters after a node deletion.

`session.delete` also forgets in-memory state that belongs to the session: the pending recluster timer. Model sessions are untouched.

### The page and the popup

- **The page.** `entrypoints/recorded` mounts `app/recordedApp` with a one-shot client.
  - It loads with `recorded.read`.
  - A node's text is fetched with `recorded.readText` when the user expands it.
  - After any deletion it reads again.
  - When the session itself is deleted, it shows the empty state.
- **The popup.** It gains a "What was recorded" button while a session is active or closed. The button sends `recorded.open`, which opens `recorded.html` outside groups through `openMapTab`.
- **Confirmation.** It is inline rather than through `window.confirm`: a modal dialog would block the e2e harness and the browser's extension pages alike.

### End-to-end

`recordedData.e2e.ts`:

1. Builds a session with a deep-read article: grant access, scroll, copy.
2. Opens "What was recorded" and checks the article's entry.
3. Shows its text.
4. Deletes the article, and checks that the database holds no node, snapshot, chunk or vector of it.
5. Deletes the session, and checks that the session store is empty and the group still exists.

A `recordedPage` fixture reads the page's DOM and clicks its buttons in the content context, like the map fixture.

## Risks / Trade-offs

- **[Deleting the active session leaves its group open and unfollowed]** → Intended: the user deleted the record, not their tabs. The popup then offers to start a session. The tabs' session marks point at nothing, and restore ignores them.
- **[No undo]** → Confirmation is the UI-003 option chosen. An undo would have to hold the deletion in memory for 10 s in an event page that may unload, which makes "deleted" uncertain.
- **[Large sessions]** → The session cascade is one transaction over a few thousand records, well within IndexedDB's limits.

## Migration Plan

- **Version 12:** create the five indexes. There are no rewrites.
