# Design

## Context

- **Capture.** Reading time is counted in `tabCapture/trackActiveDwell`. It is called on every
  focus event and adds a capped interval to the node's `activeDwellMs`.
  - Copies arrive from the page observer as counts in `signal.batch` and are added by
    `pageSignals/recordSignalBatch`.
  - Nothing keeps the time of either.
- **The map.** It receives a `GraphSnapshot` over a port after every write, and draws it with React
  Flow and dagre.

## Decisions

### 1. One activity store (migration 21)

- **Shape.** `{ id, sessionId, nodeId, kind: "focus" | "copy" | "paste", at, endAt }`. It is
  indexed by `sessionId`, for the map and for session deletion, and by `nodeId`, for page deletion
  and for joining intervals.
- **One store, not two.** Readers want the session's activity in time order, all of it. Two
  stores would be two reads and a merge.
- **Logged where it is counted.** The log is written in `trackActiveDwell` from the same capped
  interval that is added to the dwell total, so the timeline and the total cannot disagree.
- **Joining.** An interval that starts within 1 s of the page's last one ends extends that record.
  Focus events are frequent, and one block per event would be noise.
- **Copy and paste times.** These are the background's receipt time. A batch is at most about 2 s
  old, which a timeline measured in minutes cannot show. Trusting the page's clock would let a page
  place marks anywhere.
- **Existing nodes.** They get `pasteEvents: 0` in the same migration, like quick returns did in
  migration 9.

### 2. The snapshot carries the log

The log is in `graph.snapshot` rather than in a separate request: the views must update live, and
the snapshot already does. A session logs at most a few thousand small records, well within the
size of a port message.

### 3. Views live in `researchMap`

The views are pure functions of a snapshot, each with a model function and a component:

- `buildHistoryEntries` / `HistoryView`
- `buildAnchorLayout` (with `selectAnchors` and `buildAnchorLinks`) / `AnchorView`
- `buildTimeline` and `buildTimeScale` / `TelemetryView`

They sit beside the tree in `researchMap` rather than in features of their own, because they share
the snapshot type and are imported by path from the map's composition root alone. As with the
tree, none of them is in the barrel: the background imports that barrel and must not bundle React
Flow or dagre.

### 4. Anchors (`anchor_rules@1`)

- **Which pages.** A page is an anchor when it meets any one of these:
  - at least 2 revisits;
  - at least 2 copies and pastes together;
  - at least 3 minutes of reading.
- **Versioning.** The rules are versioned like the engagement rules, and nothing is stored.
- **Links.** These come from the order of reading. Every change from one anchor to another is a
  move, even with other pages read in between. Arrows show the directions taken, and thickness
  shows how often.
- **Older sessions.** A session without a log uses its co-attention edges between anchors instead.
- **Layout.** Anchors sit on a ring and the session's first page sits above it. Edges use the
  handles on the sides that face each other. "Show paths" lays every page out with dagre over the
  opener, same-tab and refinement edges, and draws the anchor links on top.
- **Collecting.** A page with more pastes than copies is outlined as where research is collected.
  This is said in words as well.

### 5. The telemetry timeline

- **Drawing.** It is SVG, with no chart library.
- **Blocks.**
  - There is one block per logged interval.
  - The colour is the cluster's place in the session's clustering. The colour follows the
    cluster, so a new interval never repaints the others.
  - The eight validated categorical slots are used for the first eight clusters, with one step
    each for the light and dark themes. Further clusters are "Other", in neutral grey.
  - Height grows with the square root of duration, capped at 20 minutes.
- **Labels and legend.** Runs of one cluster are labelled once, rotated, above the strip. Labels
  use text colour, not the series colour. A legend names every colour shown, so identity is never
  carried by colour alone.
- **Marks.** Copies are dots (●) and pastes are squares (■), so the two differ in shape.
- **Time axis.** A pause longer than 15 minutes becomes a fixed-width break, so a session resumed
  the next day does not spend its width on the night. Ticks use the finest round step that leaves
  72 px between labels.
- **Zoom.** Zoom multiplies the fitted scale by up to 32. Buttons control it; the wheel is left to
  scroll.
- **Hover.** Hovering or focusing a block shows its cluster, its time and length, the page, and up
  to 600 characters of its captured text.
  - The text comes from `map.readExcerpt`, served through the same live-session check as "What
    was recorded".
  - It is asked for once per page.

### 6. View state

The current view is kept in `location.hash`, so a reload keeps it. The keys 1–4 switch views
except while typing in a field or with a modifier held.

## Risks

- **Log growth.** There is one record per focus stretch, so a long session has thousands of them.
  They are small, and they are deleted with the session.
- **Sessions recorded before migration 21.** These have no log.
  - History falls back to the order pages were opened, and says so.
  - Telemetry says reading time is logged from now on.
  - Anchors fall back to co-attention.
