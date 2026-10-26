# Design

## Context

`trackActiveDwell` adds the time since the visit's last mark (`session.focus.since`) when it is called, caps one stretch at 10 minutes, and marks again. It is called by `followFocus`, which the background runs after tab and window events, idle changes and each signal batch. It is deliberately not a running timer, because the event page may be unloaded at any time; the open visit lives on the session record. After accruing dwell, `followFocus` asks for the page's text if the node is now deep read (`requestSnapshotIfDue`). The observer sends `signal.batch` only when `maxScroll` grew or the page was copied from or pasted into; otherwise `flush` returns without sending. Observed in `trackActiveDwell`, `followFocus`, `observePage`, `getNodeEngagement`.

So a page that reaches 40% scroll within seconds and is then read in stillness produces no event for minutes: dwell stays at what the first batch saw, the page is not deep read, and nothing asks for its text.

## Goals / Non-Goals

**Goals:**

- A page read closely becomes deep read at about the 30 s mark while it is still being read.
- No change to what counts as reading, or to dwell already stored; the dwell threshold for a deep read goes from 45 s to 30 s.

**Non-Goals:**

- Changing the other thresholds (40% scroll, the dead-end limits, revisits). The dwell threshold is lowered by the user's decision after the first reading by hand; any further change is made with data.
- Counting time on pages that are not observed (no page access, restricted pages): they keep their dwell updated on the events they have.
- A timer in the background. It would not survive the event page being unloaded, and an alarm wakes it for nothing when no one is reading.

## Decisions

### 1. The page ticks, the background decides

The observer starts a 10 s timer while `document.visibilityState === "visible"` and sends `signal.tick` (no payload) on each beat; it stops the timer when the page is hidden and starts it again when it becomes visible. The background does not take the page's word that it is being read: `readSignalTarget` still checks that the tab's current node is the page's, and `followFocus` asks the browser which tab is selected and whether the user is idle. A tick from a page that is not being read adds nothing, and one from a page that has been left is dropped as a stale batch is.

### 2. A tick is a batch with nothing in it

The handler runs what a batch runs after recording its numbers — `followFocus`, then `requestSnapshotIfDue` for the current node — and records no signal. It answers `signal.recorded`, or `signal.dropped` with `stop` as a batch does, so an observer in a tab that left the session stops. Treating it as the same path keeps one rule for "this page is current".

### 3. 10 seconds, and a 30 s deep read

The deep-read mark is 30 s, so a 10 s beat finds it within about 10 s of being reached; a shorter beat costs more wake-ups of the background for no gain in judgement. The beat is a constant in `pageSignals`.

### 4. Cost

Each tick is one message and, if reading is counted, one write of the node's dwell and one extension of the latest focus interval (`recordFocusInterval` merges intervals a second apart). A visible page sends 6 a minute. A page in a background tab sends none.

### 5. Why not the existing batch

Sending an empty batch every few seconds would do the same, but `flush` skips empty ones on purpose, and the batch's meaning — "numbers since last time" — would blur. A separate, named message is clearer in the schema and the specs.

### 6. The rule set is renamed

A lowered threshold is a new rule set, so the version becomes `engagement_rules@3`; the target spec, the capability specs and the comment that names it say so. Engagement is derived where it is read and never stored, so no record is rewritten: the map and the deep-read decision judge every page's stored dwell by the new threshold from now on.

## Risks / Trade-offs

- **More messages while reading.** Accepted: tiny, only for the visible page of a session.
- **Waking an unloaded background every 10 s while reading.** It would be woken by the first batch anyway; this keeps it awake while reading, which is also when a job's hold page may be keeping it. Accepted.
- **A page that is visible but ignored** (the window is behind another application) ticks, but the background sees the window is not focused and adds nothing.
- **Thresholds may still be too strict for real reading.** The dwell is lowered to 30 s (`engagement_rules@3`); the scroll limit stays. With ticks the stored dwell becomes accurate, so the next look at real data is meaningful.

## Open Questions

- Should the beat be adaptive, slower once a page is already deep read? A page already judged deep read needs no more ticks for the text, but dwell is still shown in "What was recorded". Left at a constant.
