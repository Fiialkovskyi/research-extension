# Proposal

## Why

The last open line of M1 is the research tree (UI-001 to UI-003): the surface where a user sees how
the research branched, what they read closely, what they abandoned, and what they opened but never
looked at.

The target spec puts it in a sidebar. Instead it goes into the popup the user already opens from the
toolbar, by the maintainer's choice:

- one surface to learn instead of two;
- no sidebar taking width from the pages being read.

The popup already shows the active session, and the map's live snapshot stream carries almost
everything the tree needs.

## What Changes

- **The research tree in the popup.** While a session is active, the popup shows the session as a tree
  under its title and page count:
  - each page under the page it was reached from: the previous page in its tab, or else the page that
    opened its tab;
  - the searches at the top level, in the order they were made;
  - each row shows the page's title (or a search's query), its engagement in words and by a shaped
    marker, a copy marker when the user copied from it, and whether its tab is closed.
- **The tree follows the WAI-ARIA tree pattern** (REQ-UI-002):
  - one tab stop;
  - arrows move, expand and collapse;
  - Home and End jump to the first and last row;
  - Enter or a click on an open page selects its tab.
- **An unread queue** above the tree lists the session's open pages never looked at, with their count,
  oldest first. Activating one selects its tab.
- **Live updates.** The popup subscribes to the `graph.subscribe` stream over a port while it is open,
  and the tree updates in place. Rows keep their expanded state across updates.
- **The graph snapshot** gains each page's copy count.
- **Scrolling.** The popup keeps its width. The tree scrolls inside it once it is taller than the popup
  allows.

**Out of scope:**

- **A sidebar.** The target spec's sidebar is replaced by this, and the target spec is updated to say
  so.
- **Clusters, renaming and "Prune dead ends".** Clusters arrive in M2.
- **Destructive actions, and with them UI-003's undo.** This change adds no destructive action. UI-003
  applies to the first change that does.
- **Incremental `graph.patch` messages.**

## Capabilities

### New Capabilities

- `research-tree`: the popup's tree of the active session, its rows, the unread queue, keyboard use,
  live updates and returning to a page's tab.

### Modified Capabilities

None. The popup's existing requirements still hold: the tree is added below what it already shows.

## Impact

- **New code:**
  - `src/features/researchTree/`, with model `buildResearchTree`, `listVisibleRows`, `moveTreeFocus`
    and `listUnreadPages`, and ui `ResearchTree` and `UnreadQueue`;
  - `shared/config` `ENGAGEMENT_DISPLAY`, shared with the map.
- **Changed code:**
  - `app/popupApp`: a graph stream beside its one-shot client;
  - `entrypoints/popup`: opens a port;
  - `researchMap`'s snapshot gains `copyEvents`.
- **Manifest:** unchanged.
- **e2e:** the popup reader also reads the tree and the queue.
