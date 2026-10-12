# Proposal

## Why

One line of M1's capture checklist is still open:

- **REQ-CAP-007, co-attention edges.** When a user flips between two pages to compare them, the pages
  belong together, whether or not one led to the other. Opener and same-tab edges cannot express that
  relation, and clustering in M2 needs it.
- **The return-to-SERP clause of the dead-end rule.** A result abandoned by going straight back to the
  search is the clearest dead end there is. `engagement_rules@1` left that clause out.

Both are now cheap. `add-engagement-signals` made the background follow every change of focus from
one node to another, which is exactly the event both rules are built from.

## What Changes

- **Co-attention edges.** When focus moves between the same two nodes of the active session at least 3
  times within 5 minutes, in either direction, a `coAttention` edge joins them, once. The recent moves
  are kept on the session record, so an unloaded event page forgets none.
- **Quick returns.** A page reached from a search result page, whose first visit ends within 10 s of
  active time by moving to a search result page, counts a quick return. That covers going back in the
  same tab and switching back to the search's tab. Nodes gain the signal `quickReturnCount`, and a
  migration gives existing nodes 0.
- **`engagement_rules@2`:**
  - `dead_end` also covers a page with a quick return, unless it is deep read;
  - `deep_read`'s revisit clause names the 20 s that a revisit already requires.
- **The map** draws a co-attention edge without an arrow and dashed unlike an opener edge, and leaves
  it out of the top-down layout: the two pages were read side by side, and neither came first.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `research-graph`: adds co-attention edges.
- `page-signals`:
  - the engagement rule set becomes `engagement_rules@2`, with the quick-return dead end;
  - a new requirement defines a quick return.
- `research-map`: adds how a co-attention edge is drawn and laid out.

## Impact

- **Code:**
  - `tabCapture/model/trackActiveDwell` gains two private helpers, for co-attention and quick returns;
  - `researchSession/setSessionFocus` also writes the recent moves;
  - `shared/config/engagementRules` gains the new thresholds;
  - `researchGraph/getNodeEngagement`;
  - `researchMap` layout and styling.
- **Storage:**
  - Database version 9 rewrites node signals with `quickReturnCount: 0`.
  - `StoredSession` gains an optional `recentSwitches`.
- **Target spec:** REQ-CAP-007 is done; the note on the return-to-SERP clause is removed.
