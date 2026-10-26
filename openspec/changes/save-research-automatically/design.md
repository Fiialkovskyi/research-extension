# Design

## Context

Saving used to be one action with four effects: flush the pages' pending signals, record the tabs
and the left-off page, close the session's pages and tabs, and mark the session `saved`. Without
the button, the tabs are gone by the time anything could record them: Firefox reports a removed
group after its tabs, and a quit or a closed window may report nothing at all until the next start.

## Decisions

### 1. Record the tabs while they exist, debounced

The tabs are recorded while the session is active, from the same capture events that already
follow every tab and navigation. A record taken straight after each event is wrong while a group
closes: Firefox removes its tabs one by one, and a record between two removals keeps some of them.
So every capture event re-arms a timer, and the record is taken once capture has been quiet for
1 s — far longer than a group takes to close, after which the session is no longer active and the
record is skipped. The wait is capped at 5 s from the first change, so steady browsing is still
recorded. An empty group is never recorded either, for the closing of a group's last tab.

The timer lives in memory, like the recluster debounce: if the event page unloads first, the next
capture event arms it again.

_Rejected:_ recording on group removal (the tabs are gone); deriving the tabs from open nodes at
close (tab-strip order is not recorded, and closed tabs have closed their nodes by then); reusing
the 5 s recluster debounce (steady activity postpones it indefinitely — the e2e suite's database
reader, switching tabs every 100 ms, showed exactly that).

### 2. Record the left-off page at close, not continuously

`lastPosition` drives "You left off at", shown while the user is on that page and cleared when
they move on. Recording it continuously would show it all the time. It is recorded where the
session closes, from the focus or the latest `lastFocusedAt`, which needs no tab.

### 3. A closed session is a saved one, for the library

The `closed` status is kept: it is what lets a restored group or tab bring the session back by
itself, and the session-restore tests depend on it. The library lists `saved` and `closed` alike,
and resuming accepts either. Resuming a closed session must not "end" it first, as resuming
another session does with a closed one.

### 4. Pending signals are not flushed

The button asked each page for its pending signals before saving. Pages send them every 2 s and on
hide anyway; losing up to that much of the last scroll on close is accepted. The flush message
stays in the page observer.

## Risks

- A record lands in the 5 s cap exactly while a group is closing: the library keeps fewer tabs.
  Needs a 5 s burst ending within milliseconds of a group closing; accepted.
- Firefox quits within 1 s of the last tab change: that change is not recorded.
