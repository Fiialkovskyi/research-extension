# Design

## Context

For the motivation, see proposal.md (Why). The requirements are in `specs/research-session` and `specs/extension-shell`.

The current state:

- The popup renders only the greeting and does not talk to the background.
- The background coordinates the extension. It validates every incoming message against the requests the features contribute (`app/backgroundApp/schemas.ts`), and it already answers a feature's failure as an expected reply. `benchmark.failed` is an example.
- `@wxt-dev/browser` already types `tabs.group` and the `tabGroups` namespace.
- The declared minimum, Firefox 140, is above the release that shipped both APIs (139).

The constraint that shapes the design is that **the popup cannot be relied on to finish anything**. The popup closes when the user clicks elsewhere or switches tabs, and that destroys its context. We planned on the assumption that moving focus to the new tab would also close it. In Firefox 157 it does not when the extension activates the tab itself (see Findings, popup reply). But a popup's lifetime is still the browser's choice, not ours, so the decision below stands.

## Goals / Non-Goals

**Goals:**

- Create a titled group with one tab from the popup, the way the spec describes.
- Answer the Findings questions below by running the code in a real Firefox, not by reading the documentation.
- Leave behind a `tabGroups` feature that the session-tracking change extends instead of replacing.

**Non-Goals:**

- Following the group after it is created. Not one event listener is added.
- Remembering which group is the session, either in storage or in memory. The single-session MVP needs this, but this spike only gathers the facts that decide how to do it (see Findings, group identity).
- A colour picker. Firefox assigns the colour.

## Decisions

### The background does the work, and the popup only asks

The popup sends one `tabGroup.create` message over `runtime.sendMessage`, and the background runs the whole sequence.

The alternative was to run the calls in the popup. That was rejected because the popup can close at any moment the user moves on, and any call after that point never runs. It would also break the project rule that surfaces send intents and the background acts on them.

A one-shot message is enough: nothing streams, and a port would only keep alive a surface the user is about to leave.

### Order: create hidden, group, title, read back, then focus

1. `tabs.create({ active: false })`
2. `tabs.group({ tabIds: [tabId] })`
3. `tabGroups.update(groupId, { title })`
4. `tabGroups.get(groupId)`, to read the colour Firefox assigned
5. `tabs.update(tabId, { active: true })`

The tab gets focus last, so the user never sees an ungrouped or untitled tab. It also means focus moves only once the group exists.

The background builds the reply before step 5. Whether that reply still reaches the popup is one of the Findings, and the outcome is correct either way.

### Rollback closes the tab

If step 2, 3 or 4 fails, the background closes the tab from step 1 and answers `tabGroup.failed` with the reason. This is the same discipline as `downloadModelFiles`: a failed attempt leaves nothing behind.

Firefox deletes a group when its last tab leaves it. So closing the tab also removes a group that was created but never titled. That behaviour is itself checked in Findings.

### The browser API is a structural dependency

`createTabGroup` takes a `TabGroupApi`, an interface covering only the six calls it uses. The background entrypoint passes the real `browser.tabs` and `browser.tabGroups` methods into it. This is the same pattern as `BackgroundPort`: the sequence and its rollback are unit-tested without an extension runtime.

### The title is validated in the message schema

The request schema trims the title, rejects an empty one, and limits its length. So a blank title is refused at the protocol boundary (`rpc.refused`) and never reaches the browser. The form also disables submit for a blank title. That is a convenience; the schema is the guarantee.

### Only the `tabGroups` permission

`tabGroups.*` requires the `tabGroups` permission. `tabs.create`, `tabs.group` and `tabs.update` need none, and `tabs` is needed only to read URLs and titles, which the extension does not do.

The first Findings item confirms this, because it rests on documentation until it has been run.

## Risks / Trade-offs

- [A permission is missing and the calls fail only in a real browser.] → The e2e spec runs the whole path in Firefox, and Findings records the exact error if a call is refused.
- [The popup closes before an error can be shown.] → An error happens before step 5, and focus moves only at step 5. So the popup is still open when it receives a `tabGroup.failed`.
- [Group ids may not survive a restart, and a later change would key the session on them.] → This is not decided here. It is the first thing Findings measures.

## Findings

Observed in Firefox 157.0 on macOS through the WebdriverIO harness, from a temporary probe spec that called the APIs from an extension page and drove the real popup. Headless unless noted.

- **Permissions:** confirmed as designed.
  - With `tabGroups` declared, every call works, and `permissions.getAll()` reports `["tabGroups"]`.
  - Without it, `tabs.group` still works: a group is created and `tabs.onUpdated` reports the new `groupId`. But `browser.tabGroups` is `undefined`, so reading it fails with `TypeError: can't access property "get", browser.tabGroups is undefined`. Without the permission an extension can group tabs but cannot title a group, read its colour, or hear its events.
  - Without `tabs`, a `Tab` carries no `url` or `title`. It does carry `groupId`, `openerTabId`, `active` and `lastAccessed`, which is everything membership tracking needs. Page URLs will need `tabs` or host permissions later; that belongs to capture, not to this spike.
- **Colour assignment:**
  - A new group gets the first colour no open group uses, in this order: blue, purple, cyan, orange, yellow, pink, green, grey, red. That is the order of `TAB_GROUP_COLORS`.
  - Once all nine are in use, colours repeat; the 10th and 11th groups got grey and cyan.
  - With no other group open, the session's group is blue. That is also what the e2e test saw.
- **Group identity:** **the id survives a restart.**
  - Checked by hand in a regular Firefox profile with session restore on. The extension was loaded temporarily and loaded again after the restart.
  - The group `уууу` had `id: 1791558634077086` before quitting Firefox and the same id after the restart. Its title and colour (`blue`) were also unchanged.
  - Only `collapsed` differed: `false` before, `true` after.
  - Ids are large integers whose leading digits are the creation time in milliseconds. So Firefox derives them from the group's internal id, which session restore saves, and that is why they persist.
  - For the single-session MVP: store the session's `groupId` and look the group up by that id after a restart. Do not depend on `collapsed`. `windowId` was the same in this check, but a window id is not a stable key in general, so the group should be found by its own id.
  - **Saved groups: still open.** Closing a group to Firefox's saved groups and reopening it later was tried in the automated profile and could not be reproduced there.
    - `saveAndClose()` closed the group, but `SessionStore.getSavedTabGroups()` stayed empty. This happened with `about:blank`, an extension page and a web page alike.
    - Whether a reopened group keeps its id therefore needs a manual check in a regular profile. Session restore is a firm requirement, so the session-tracking change must answer this before it relies on `groupId` alone.
- **Last tab closed:** the group is deleted.
  - Events, in order: `tabs.onRemoved`, then `tabGroups.onRemoved` with `{ isWindowClosing: false }`.
  - Afterwards `tabGroups.get(id)` rejects with `No group with id: <id>`.
  - This is also why rollback by closing the tab leaves nothing behind.
- **Membership changes:**
  - Grouping an ungrouped tab, a tab joining a group, and a tab leaving one (`tabs.ungroup`) each fire `tabs.onUpdated` with a `groupId` change. Leaving reports `-1`.
  - **A tab opened from a grouped tab joins its group by itself.** `tabs.onCreated` already reports the opener's `groupId`, with `openerTabId` set.
  - A new group fires `tabGroups.onCreated` with an empty title and its colour. Setting the title fires `tabGroups.onUpdated`.
  - `tabGroups.onMoved` was not exercised, because no group was moved.
  - So tracking one session needs `tabs.onCreated`, `tabs.onUpdated` (filtered to `groupId`), `tabs.onRemoved`, `tabGroups.onUpdated` (rename and recolour) and `tabGroups.onRemoved` (the session ended because its last tab closed). Opener chains are no longer needed to decide membership. They remain useful only as graph edges.
- **Popup reply:** **the popup stayed open, and the reply arrived.**
  - After submit, the new tab took focus inside the new group, and the panel was still open over the next second.
  - The popup rendered `Started "Popup probe".`. This held in both headless and headed runs.
  - Firefox does not close an extension's popup when the extension itself activates a tab. The success message the popup renders is therefore something the user sees, not dead code.
  - The design does not depend on this: the user can still close the popup at any time.
- **Proposed amendment** (for the session-tracking change to apply to `RESEARCH_GRAPH_EXTENSION_SPEC.md`):
  - **REQ-RT-001:** The extension SHALL NOT inject content scripts or record telemetry until the user explicitly starts a session. A session is started by naming it in the popup, which creates a Firefox tab group with that title. Until after the MVP, at most one session SHALL be active: starting one while another is active SHALL be refused or SHALL first end the active one.
  - **REQ-CAP-004:** A tab SHALL belong to the active session if and only if it is in the session's tab group. Tabs that join the group, including those Firefox adds because they were opened from a grouped tab, SHALL be captured from the moment they join. Tabs that leave the group SHALL stop being captured but keep their recorded history. Tabs outside the group SHALL NOT be captured.
  - **New:** WHEN the session's group is removed because its last tab closed, the session SHALL end, saved rather than deleted.
