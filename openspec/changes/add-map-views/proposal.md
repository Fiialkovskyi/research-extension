# Proposal

## Why

The research map draws one picture of a session: the tree of how each page was reached. It cannot
show _when_ the user read what, which pages the research kept coming back to, or where findings
were collected. The "Discovering User Intent" demo shows four views of the same session — a plain
history, the tree, an anchor view and a telemetry timeline — behind one switcher. That is the UX
we want on `map.html`.

None of these views can be drawn from what capture keeps today. Reading time is a running total
per page; copies are a count with no time; pastes are not seen at all.

## What Changes

- **An activity log.**
  - Every counted interval of active reading is logged, as a page and a start and end time.
    Back-to-back intervals on one page are joined.
  - Every copy and paste is logged as a page and a time, the time the batch reached the
    background. The page's clock is not trusted.
  - Times and pages only: the log has no field for content.
- **Paste capture.** The page observer counts trusted `paste` events the way it counts copies. It
  never reads the clipboard or the field pasted into. Nodes gain a `pasteEvents` count.
- **The map's snapshot** carries each page's reading time, focus, revisit and paste counts, and
  the session's activity log.
- **Four views on the map.**
  - A switcher in the header picks between them; the keys 1–4 do too. The address (`#telemetry`)
    keeps the view across a reload.
  - **Simple history:** every stretch of reading in order, with its start time and length.
  - **Tree:** the existing map, unchanged.
  - **Anchors:** the pages the session kept coming back to, sized by reading time and joined by
    how often the user moved between them. "Show paths" adds the other pages.
  - **Telemetry:** a timeline of reading intervals coloured by cluster, with copy and paste
    marks. Hovering a block shows the page and the start of its captured text.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `research-map`: the map has four views, a switcher, and a text preview in the telemetry view.
- `page-signals`: pastes are counted, and reading, copies and pastes are logged with their
  times.
- `recorded-data`: deleting a page or a session deletes its activity log.

## Impact

- **Code:**
  - migration 21 adds the `activity` store (indexed by session and page) and gives existing
    nodes `pasteEvents: 0`;
  - new `features/activityLog`: `recordFocusInterval`, `recordPageMarks`,
    `readSessionActivity`;
  - `trackActiveDwell` logs each interval it counts, and `recordSignalBatch` logs copies and
    pastes;
  - `observePage` listens for `paste`, and `signal.batch` gains `pasteEvents`;
  - `researchMap` gains the view models and components;
  - `anchor_rules@1` goes in `shared/config`;
  - `app/backgroundApp` answers `map.readExcerpt`.
- **Network:** none. The excerpt is read from the local encrypted snapshot.
