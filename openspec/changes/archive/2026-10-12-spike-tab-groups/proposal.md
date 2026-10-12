# Proposal

## Why

The target spec defines a research session's tabs by opener chains (REQ-CAP-001, REQ-CAP-004), and starts a session from a toolbar action (REQ-RT-001). We now intend to amend that: **a research session is a Firefox tab group**. The group's tabs are the session's tabs, and the group's title is the session's name. Firefox keeps that membership itself and shows it to the user, and the user can change it by dragging a tab in or out. That replaces most of the heuristic membership the spec currently prescribes.

The amendment rests on a platform API the extension has never touched: `tabs.group` and the `tabGroups` namespace, both new in Firefox 139. Before the session model is rewritten around it, this spike confirms on a real browser that an extension can create a named group, read back its colour, and learn what it would need to follow the group afterwards.

## What Changes

- The popup gains a **title input**. Submitting it creates a new tab group with that title, holding one new, empty tab (the browser's new-tab page), and moves the focus to that tab.
- **Firefox assigns the group's colour.** The extension does not choose one. It reads the colour back and reports it, so the spike records what Firefox actually does.
- The **background** does the work, not the popup. The popup sends one message and may be closed by the time the work finishes. The user can dismiss it at any moment, which would cut short a chain of browser calls run from the popup itself.
- The manifest declares the **`tabGroups` permission**. No other permission and no network behaviour is added.
- The spike's **findings** are recorded in `design.md`:
  - which permission each call really needs;
  - how Firefox picks colours;
  - whether a group id survives a browser restart;
  - what happens to a group when its last tab closes;
  - which events a later tracking change would subscribe to;
  - the proposed wording of the REQ-CAP-004 and REQ-RT-001 amendment.

## Capabilities

### New Capabilities

- `research-session`: How a research session is started and which tabs belong to it. It starts with one requirement, that a session can be started as a named Firefox tab group. Later changes add to it: following the group's tabs, saving, resuming, deleting.

### Modified Capabilities

- `extension-shell`: Adds a requirement that the manifest declares the browser permissions its surfaces use (`tabGroups`), and adds no network permission. The existing popup requirements still hold. The greeting stays, and clicking the toolbar icon still opens only the popup, because the tab is opened by a separate, explicit submit inside it.

## Impact

- **New code:**
  - `src/features/tabGroups/`, which holds the message schemas, the `createTabGroup` sequence (with rollback if a step fails), and the `GroupForm` component;
  - an e2e fixture that reads tab groups through Firefox's chrome context, and an e2e spec.
- **Modified code:**
  - `src/app/backgroundApp` gets a new `tabGroup.create` message and a `tabGroups` dependency;
  - `src/entrypoints/background` supplies that dependency;
  - `src/app/popupApp` and `src/entrypoints/popup` now render the form and send the message;
  - `wxt.config.ts` declares the permission.
- **Permissions:** `tabGroups` is added. Firefox may show it as a new prompt at install time. `tabs` is not needed: the extension never reads tab URLs or titles.
- **One session at a time, until after the MVP.** Later changes plan for exactly one active research session, which means one tracked group. Several concurrent sessions are deferred until after the MVP. This spike creates a group each time the form is submitted, because it observes the API and does not enforce the model. Its findings are written for the single-session case, which needs to know how to recognise _the_ session's group again.
- **Out of scope:**
  - concurrent sessions, deferred until after the MVP;
  - following the group after it is created, meaning tab membership events, graph nodes and edges, renames and colour changes;
  - saving, resuming and deleting sessions;
  - choosing the colour in the UI;
  - editing `RESEARCH_GRAPH_EXTENSION_SPEC.md` itself. The amendment is proposed here and applied by the change that implements session tracking.
