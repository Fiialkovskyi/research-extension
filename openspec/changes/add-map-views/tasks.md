# Tasks

## 1. Storage and capture

- [x] 1.1 Add the `activity` store and `pasteEvents` (migration 21). Verify with the migration spec.
- [x] 1.2 Create `features/activityLog` with `recordFocusInterval`, `recordPageMarks` and `readSessionActivity`. Verify with specs for joining intervals, never joining across pages, and order.
- [x] 1.3 Log intervals in `trackActiveDwell`. Verify with a spec that a discarded interval logs nothing.
- [x] 1.4 Count trusted pastes in `observePage`, and log copies and pastes in `recordSignalBatch`. Verify with specs.
- [x] 1.5 Delete the activity log with its page and its session, and move it on reattach. Verify with the deletion specs.

## 2. Snapshot and background

- [x] 2.1 Carry per-page reading, focus, revisit and paste counts, and the activity log, in `GraphSnapshot`.
- [x] 2.2 Answer `map.readExcerpt` with the first 600 characters of the page's text. Verify with a background spec.

## 3. Views

- [x] 3.1 Add the view switcher, the keys 1–4 and the view in the address to `MapApp`. Verify with its spec.
- [x] 3.2 Add `buildHistoryEntries` and `HistoryView`.
- [x] 3.3 Add `anchor_rules@1`, `selectAnchors`, `buildAnchorLinks`, `buildAnchorLayout`, `AnchorNode` and `AnchorView`.
- [x] 3.4 Add `buildTimeline`, `buildTimeScale` and `TelemetryView`, with the tooltip and zoom.

## 4. Documentation and verification

- [x] 4.1 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`: §4, the paste event and timestamped log; §11, the research map's four views.
- [x] 4.2 Run `npm run verify` and confirm that it passes.

## Deferred

- [ ] Manual check: browse a session across tabs, copy and paste, open the map, and walk all four views in light and dark.
