# Proposal

## Why

The extension now keeps a lot about the user's research, and the user can neither see it nor remove
it:

- URLs and titles;
- reading signals;
- the encrypted text of deep-read pages;
- chunk ranges;
- vectors;
- clusters.

REQ-SEC-008 requires a "What was recorded" view with a delete control for every item, and REQ-STO-008
requires deletion to cascade. With the denylist and encryption in place, this is the last large privacy
piece. It is also the first change to add destructive actions, so UI-003 (undo or confirm) applies
here for the first time.

## What Changes

- **A "What was recorded" page** (`recorded.html`) is opened from the popup while a session is active or
  closed. For that session it lists every page with:
  - its title, URL and when it was recorded;
  - its signals: active reading time, scroll depth, copies, focus count, revisits and quick returns;
  - whether it has a snapshot, and its size and capture time, with the text itself shown on request,
    decrypted;
  - how many vectors it has.
- **Deleting a page** removes, in one transaction:
  - the node;
  - every edge touching it;
  - its snapshot, chunks and vectors (in every space);
  - its pending jobs.

  The session is then reclustered. Pages reached from it keep their own records, and the tree places
  them at the top level.

- **Deleting the session** removes every record carrying its session id — nodes, edges, snapshots,
  chunks, vectors, jobs and its clustering — and the session itself, in one transaction (REQ-STO-008).
  Its tab group is left open, and is no longer followed.
- **Confirmation** (UI-003). Each delete control asks for confirmation inline, with a second button
  naming exactly what will be deleted, before anything is sent.
- **Indexes.** Database version 12 adds `sessionId` indexes to `snapshots`, `chunks`, `vectors` and
  `jobs`, and a `nodeId` index to `vectors`, so both cascades read only what they delete.

## Capabilities

### New Capabilities

- `recorded-data`: the view of what a session recorded, reading a page's text, and deleting a page or
  the session with their cascades and confirmation.

### Modified Capabilities

None.

## Impact

- **New code:**
  - `src/entrypoints/recorded/` (wiring) and `src/app/recordedApp/`;
  - `features/recordedData/`, with model `readRecordedSession`, `deleteNode` and `deleteSession`, and
    UI for the page list and the confirm button.
- **Changed code:**
  - `app/backgroundApp` handles the new requests (`recorded.read`, `recorded.readText`, `node.delete`,
    `session.delete`, `recorded.open`), and reclusters and pushes after a deletion;
  - the popup gains a "What was recorded" button;
  - `researchMap/openMapTab` is reused to open the page outside any group.
- **Storage:** database version 12 adds the indexes.
- **Out of scope:**
  - saved sessions in the view, which arrive with the library in M3;
  - undo after a deletion, since confirmation is the UI-003 option taken;
  - deleting facts and statements, which do not exist yet;
  - per-item deletion of signals alone.
