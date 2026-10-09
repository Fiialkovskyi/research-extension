# Design

## Context

For the motivation, see proposal.md (Why). The requirements are in `specs/research-session` and `specs/extension-shell`.

The current state:

- The popup renders only the greeting and does not talk to the background.
- The background coordinates the extension. It validates every incoming message against the requests the features contribute (`app/backgroundApp/schemas.ts`), and it already answers a feature's failure as an expected reply. `benchmark.failed` is an example.
- `@wxt-dev/browser` already types `tabs.group` and the `tabGroups` namespace.
- The declared minimum, Firefox 140, is above the release that shipped both APIs (139).

The constraint that shapes the design is that **the popup cannot be relied on to finish anything**. When focus moves to another tab, Firefox closes the popup and destroys its context. Moving focus to the new tab is exactly what the requirement asks for.

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

The alternative was to run the calls in the popup. That was rejected because the popup closes as soon as focus moves to the new tab, so any call after that point never runs. It would also break the project rule that surfaces send intents and the background acts on them.

A one-shot message is enough: nothing streams, and the popup does not stay open long enough to hold a port.

### Order: create hidden, group, title, read back, then focus

1. `tabs.create({ active: false })`
2. `tabs.group({ tabIds: [tabId] })`
3. `tabGroups.update(groupId, { title })`
4. `tabGroups.get(groupId)`, to read the colour Firefox assigned
5. `tabs.update(tabId, { active: true })`

The tab gets focus last, so the user never sees an ungrouped or untitled tab. It also means focus moves only once the group exists, and moving focus is what closes the popup.

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

To be filled in while the spike runs. Each entry records what was observed, in which Firefox version, and what it means for the session-tracking change.

- **Permissions:** whether `tabGroups` alone is enough, and the exact error, if any, without it.
- **Colour assignment:** which colour Firefox gives successive new groups, and whether it avoids colours already in use.
- **Group identity:** whether a group's `id` is the same after a browser restart with session restore. If it is not, the single-session MVP has to recognise *its* group some other way, for example by an id recorded in storage plus the title, or by re-matching tabs.
- **Last tab closed:** whether the group disappears and which events fire (`tabGroups.onRemoved`, `tabs.onRemoved`).
- **Membership changes:** what fires when a tab is dragged into or out of the group, or opened from a tab inside the group: `tabs.onUpdated` with `groupId`, `tabGroups.onUpdated`, `tabGroups.onMoved`. Also whether a tab opened from a grouped tab joins the group by itself.
- **Popup reply:** whether `tabGroup.created` reaches the popup after the tab gets focus.
- **Proposed amendment:** the wording of REQ-RT-001 and REQ-CAP-004 under "a session is one tab group, with one active session until after the MVP", to be applied by the change that implements session tracking.
