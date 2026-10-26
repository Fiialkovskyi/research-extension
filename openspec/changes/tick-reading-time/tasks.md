# Tasks

## 1. The tick

- [x] 1.1 Add `signal.tick` to the page content request schemas and `TICK_INTERVAL_MS` (10 s) to `pageSignals`; in `observePage` start a timer while the page is visible, send `signal.tick`, stop it when the page is hidden and restart it when visible again, and stop it with the observer; verify jsdom specs with fake time for visible, hidden then visible, a dropped answer that stops the observer, and no tick after `stop`.
- [x] 1.2 In `handleContentMessage`, answer `signal.tick` as a batch with no signals: `readSignalTarget`, then `followFocus` and `requestSnapshotIfDue` for the current node, and `signal.recorded` or `signal.dropped`; verify `backgroundApp` specs: a tick from the current page adds the time since the last mark and, once the page reaches deep read, asks for its text; a tick from a page the tab left adds nothing and is dropped; a tick while the window is not focused or the user is idle adds nothing; a tick records no signal.

## 2. The 30 s threshold

- [x] 2.1 Lower `deepReadDwellMs` to 30 s and name the rule set `engagement_rules@3` in `shared/config/engagementRules` and the comment that cites it; update the `getNodeEngagement` boundary specs (29,999 ms is skimmed, 30,000 ms with 40% is deep read) and verify no other spec depended on 45 s.

## 3. End to end and docs

- [x] 3.1 Add an e2e spec: open a long page in a session tab, scroll to the middle at once, then leave it untouched, and see that its text was taken without a copy, with at least 30 s of dwell; run it with `npm run test:e2e` and report. It is a smoke test of the whole path, not a proof of the tick: the spec's own database reads open a reader tab, whose tab change credits the reading time too (checked: the spec also passes with the tick disabled), so the tick alone is proven by the `backgroundApp` and `observePage` specs.
- [x] 3.2 Document in `RESEARCH_GRAPH_EXTENSION_SPEC.md` (the engagement table and the rule-set name now say 30 s and `engagement_rules@3`, REQ-CAP-005/006 note, roadmap line ticked) and run `openspec validate tick-reading-time`.
- [x] 3.3 Run `npm run verify` and report the result faithfully.
