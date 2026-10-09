# Tasks

## 1. Tab group feature: protocol and sequence

- [ ] 1.1 Add `src/features/tabGroups/` with these files. Verify that `npm run typecheck` passes.
  - `constants.ts`: `TAB_GROUP_COLORS`, the nine Firefox colours, and `TAB_GROUP_TITLE_MAX_LENGTH`.
  - `schemas.ts`:
    - `tabGroupRequestSchemas` with `"tabGroup.create": { title }`, where `title` is trimmed, non-empty and capped;
    - `tabGroupResponseSchemas` with `"tabGroup.created": { groupId, tabId, title, color }` and `"tabGroup.failed": { reason }`.
  - `types.ts`: the types inferred from the schemas, plus the structural `TabGroupApi`.
  - `index.ts`: the barrel, which leaves out `ui/` and carries the usual comment saying why.
- [ ] 1.2 Add `model/createTabGroup/` running the sequence from design.md: create the tab hidden, group it, set the title, read the group back, then focus the tab. Its `index.spec.ts` must cover these cases, and must pass:
  - the call order on success;
  - the colour coming from `tabGroups.get`;
  - the tab being closed when `group`, `update` or `get` throws;
  - `active: true` being the last call;
  - the tab never getting focus on a failed attempt.

## 2. Background wiring and permission

- [ ] 2.1 Wire the feature into the background:
  - add `...tabGroupRequestSchemas` to `app/backgroundApp/schemas.ts`;
  - add `tabGroups: TabGroupApi` to `BackgroundDependencies`;
  - handle `case "tabGroup.create"` in `app/backgroundApp/index.ts`, answering `tabGroup.created` or `tabGroup.failed`.

  Extend `app/backgroundApp/index.spec.ts`. Verify that tests cover a created group, a failure answered as `tabGroup.failed`, and a blank title refused as `rpc.refused` without any `TabGroupApi` call.
- [ ] 2.2 Pass the real `browser.tabs.{create,group,update,remove}` and `browser.tabGroups.{update,get}` in `entrypoints/background/index.ts`. This is wiring only, and the listener stays registered synchronously. Verify with `npm run typecheck`.
- [ ] 2.3 Declare `permissions: ["tabGroups"]` in `wxt.config.ts`. Verify that after `npm run build:firefox`, `.output/firefox-mv3/manifest.json` lists `tabGroups` and does not list `tabs` (extension-shell: "Package declares only the browser permissions its surfaces use").

## 3. Popup surface

- [ ] 3.1 Add `features/tabGroups/ui/groupForm/`: a labelled title input and a submit button. Submit is disabled for blank or whitespace-only input, Enter submits, and it calls `onSubmit(trimmedTitle)`. Its `index.spec.tsx` must cover blank input, whitespace-only input, Enter, a click and trimming, and must pass.
- [ ] 3.2 Give `PopupApp` a `client: { request(message): Promise<unknown> }` prop. It renders `Greeting` and `GroupForm`, sends `tabGroup.create`, checks the reply against `tabGroupResponseSchemas` and `rpcResponseSchemas`, and shows the reason on `tabGroup.failed` or `rpc.refused`. Update `app/popupApp/index.spec.tsx` and verify that it covers the greeting still rendering, the message sent, and a failure shown.
- [ ] 3.3 Supply `client.request = (message) => browser.runtime.sendMessage(message)` in `entrypoints/popup/main.tsx`. Verify with `npm run typecheck` and by the existing popup e2e still passing.

## 4. End-to-end

- [ ] 4.1 Add e2e fixture helpers under `e2e/fixtures/firefoxToolbar/utils/`, each with its own `index.spec.ts` for the pure parts, and re-export them from `utils/index.ts`:
  - `buildTabGroupsReaderScript`, a chrome-context script returning each `gBrowser.tabGroups` entry's label, colour and tab count;
  - `parseTabGroupsSnapshot`;
  - `readTabGroups`;
  - a `submitPopupGroupTitle` helper that types the title into the popup and submits it, through the same route `readPopup` uses to reach the popup's DOM.

  Verify that the unit specs pass under `npm run test`.
- [ ] 4.2 Add `e2e/specs/popupTabGroup.e2e.ts`. It opens the popup, submits a unique title, and asserts that exactly one new group carries that label, holds one tab, and has a colour from `TAB_GROUP_COLORS`. Verify with `npm run test:e2e`.

## 5. Findings and integration

- [ ] 5.1 Run `npm run dev` and fill in every Findings entry in `design.md` with what was observed and the Firefox version: permissions, colour assignment, group identity across restart, last tab closed, membership events, popup reply, and the proposed REQ-RT-001 and REQ-CAP-004 wording for one session at a time until after the MVP. Verify that no Findings entry is left as "to be filled in".
- [ ] 5.2 Run `npm run verify`. Verify that typecheck, lint, format:check, test and test:e2e all pass, and record the output for the PR.
