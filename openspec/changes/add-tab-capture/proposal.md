# Proposal

## Why

The graph store (database version 4) has no producer: a session records which group it is, but nothing about the pages read in it. This change fills the graph. Every page committed in a tab of the session's group becomes a node, and how the user got there becomes an edge. It closes REQ-CAP-001, REQ-CAP-002 and REQ-CAP-004 in their amended form (a tab is in the session if and only if it is in the session's group), and the private-window and non-web-page part of REQ-CAP-008.

## What Changes

- **Permissions:** the manifest adds `tabs` and `webNavigation` to `tabGroups` and `sessions`. Without them a tab carries no URL or title, and a navigation no transition type. No network behaviour is added.
- **A node per committed page** in a tab of the session's group:
  - top frame only, `http`/`https` only, never in a private window;
  - not on a reload; fragment changes are not navigations;
  - linked to the tab's previous node (`parentNodeId`, `sameTab` edge), and the previous node is marked closed;
  - a tab's first node is linked to the node of the tab that opened it (`openerNodeId`, `opener` edge).
- **Membership follows the group:**
  - a tab dragged into the group is recorded from its current page;
  - a tab leaving the group or closing closes its node, which keeps its history.
- **Titles** follow the tab: the title known at commit is usually the previous page's, so a later title change updates the node.
- **Focus** is counted: activating a session tab adds to its node's `focusCount` and sets `lastFocusedAt`.
- **After a restart** the session's tabs are reconciled: nodes whose tab did not come back are closed, and restored tabs without a node are recorded.
- **The popup** shows how many pages the session has recorded.
- **Capture events are processed in arrival order**, so a title update never overtakes the navigation it belongs to.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `extension-shell`: the permission requirement now declares `tabs` and `webNavigation` alongside `tabGroups` and `sessions`.
- `research-graph`: adds capture: what produces nodes and edges, membership, titles, focus and reconciliation.
- `research-session`: the popup shows the recorded page count, beside the closed-session notice added by `add-session-restore`.

## Impact

- **New code:** `src/features/tabCapture/`.
- **Modified code:**
  - `src/features/researchGraph`: `updateNodeTitle`, `countSessionNodes`;
  - `src/features/researchSession`: the summary gains `pageCount`;
  - `src/app/backgroundApp`: capture event handlers on the existing session work queue, `pageCount` in `session.active`;
  - `src/entrypoints/background`: listeners and the real `TabCaptureApi`;
  - `src/app/popupApp`: the page count;
  - `wxt.config.ts`: the permissions;
  - e2e: a local static page server, a fixture that loads a URL in the selected tab, a capture scenario.
- **Permissions:** Firefox shows a permission prompt at install and on update.
- **Out of scope:**
  - SERP detection, the session root and `refinement` edges, which are the next change (`add-serp-detection`);
  - active dwell and idle (`idle`, `windows.onFocusChanged`);
  - content scripts (scroll, copy, extraction);
  - the denylist (REQ-SEC-007);
  - single-page-app navigations (`onHistoryStateUpdated`);
  - co-attention edges.
