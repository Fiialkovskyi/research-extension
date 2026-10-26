# Proposal

## Why

Found by hand in Firefox on 2026-10-26: an article read for well over 45 seconds was not taken into research — no "Added to research" notice, no text kept — while copying a paragraph took it at once. By the rules a page is read closely after 45 s of active reading with 40% scrolled, so the reading should have been enough.

The cause is in how reading time is counted. The background adds an interval of reading to a page only when something happens that it hears about: a tab or window change, the user going idle, or a batch from the page. A batch is sent only when the page was scrolled further than before or copied from. A reader who scrolls down the first part of an article within a few seconds and then reads, without scrolling further, sends nothing for the rest of the time. The 45 s are never added, the page is never judged deep read, and its text is never asked for. The time is only credited later, when the reader leaves the tab. For the very behaviour that deep reading is meant to catch — settled, close reading — nothing is recorded as it happens.

## What Changes

- While a session page is visible, its observer tells the background every 10 seconds that it is still being read. The background answers it as it answers any event that may move focus: it brings reading time up to date, and, as before, asks for the page's text when the page has just become deep read.
- The background still decides what counts: whether the tab is the selected tab of the focused window and the user is not idle. The tick only makes sure the background looks.
- A page that is hidden, or whose tab is not the one being read, sends nothing; nothing changes for pages read without scrolling, which stay "skimmed" by the same rules.
- The dwell that makes a page deep read is lowered from 45 s to 30 s, the rule set becomes `engagement_rules@3`, and the other thresholds (40% scroll, copy, two revisits, 8 s and 15% for a dead end) do not change. A page that would have taken 45 s is now taken after 30; derived states follow at once, since they are never stored.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `page-signals`: reading time is brought up to date while a page is being read, not only when an event is heard.

## Impact

- `pageSignals` (`observePage` sends a tick on a timer while the page is visible; a new request type `signal.tick`; `backgroundApp`'s content handler answers it like a batch with no signals), `backgroundApp`, unit and e2e specs.
- No storage change, no new permission, no new network behaviour. One small message every 10 s per visible session page; the activity log merges adjacent intervals, so it does not grow with ticks.
- Reading time already stored is unchanged; pages read before this change keep their old dwell.
