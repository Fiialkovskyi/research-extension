# Tasks

## 1. Permissions

- [x] 1.1 Declare `permissions: ["tabGroups", "tabs", "webNavigation"]` in `wxt.config.ts`, updating its comment. Verify after `npm run build:firefox` that `.output/firefox-mv3/manifest.json` lists exactly those three.

## 2. Graph additions

- [x] 2.1 `researchGraph/model/updateNodeTitle` with a spec: the title changes; a blank title and a missing node change nothing.
- [x] 2.2 `researchGraph/model/countSessionNodes` with a spec: counts only the session's nodes, closed ones included.

## 3. Capture model

- [x] 3.1 Add `src/features/tabCapture/`: `constants.ts` (edge weights), `types.ts` (`TabCaptureApi`, event payloads), the barrel.
- [x] 3.2 `isCapturableUrl` with a spec: `http`/`https` accepted; `about:`, `moz-extension:`, `file:`, `data:` and unparsable URLs refused.
- [x] 3.3 `recordNavigation` with a spec: top frame only; reload, private and out-of-group tabs ignored; parent link, `sameTab` edge and parent closed; opener link and edge on a tab's first node only; no active session → nothing.
- [x] 3.4 `recordTabJoined`, `closeTabNode`, `updateTabTitle`, `recordTabFocus` with specs per the membership, title and focus rules in design.md.
- [x] 3.5 `reconcileSessionTabs` with a spec: unmatched open nodes closed, matched ones kept, uncaptured group tabs recorded as `restored`.

## 4. Background

- [x] 4.1 `backgroundApp`: add `TabCaptureApi` to the dependencies and handlers for committed navigation, tab updated, activated and removed, run through one serial queue that logs and survives a failed handler. `reconcileSession` also reconciles tabs. `session.active` carries `pageCount`. Extend `index.spec.ts`, including the order of a commit and a title update arriving together.
- [x] 4.2 Entrypoint: register `webNavigation.onCommitted`, `tabs.onUpdated`, `tabs.onActivated` and `tabs.onRemoved` synchronously, and pass the real `TabCaptureApi`. Verify with `npm run typecheck`.

## 5. Popup

- [x] 5.1 Show `· N pages recorded` (`session-page-count`) beside the active session; update `researchSession` schemas and the popup spec.

## 6. End-to-end

- [x] 6.1 Static page server for `e2e/fixtures/pages/` (`a.html` linking to `b.html`) on `127.0.0.1`, started in `onPrepare` and stopped in `onComplete`. Its pure parts get unit specs.
- [x] 6.2 A chrome-context fixture that loads a URL into the selected tab, with its script builder unit tested; extend the popup snapshot with the page count.
- [x] 6.3 e2e scenario: start a session, load `a.html` and then `b.html` in its tab, reopen the popup, and see `2 pages recorded`.
- [x] 6.4 Automate the checks first planned by hand, each as an e2e spec:
  - `sessionCapture.e2e.ts`: a link clicked in a session tab opens a tab that joins the group and records an `opener` edge; a tab moved into the group is recorded as `joined` and closed when it leaves.
  - `savedTabGroup.e2e.ts`: "Save and close" ends the session; the group reopened from the saved list keeps the id the extension recorded.
  - `sessionRestart.e2e.ts`: after a Firefox restart in a kept profile the session is active, its group has the same id, and the restored tab's page is the one open node.

  Supporting fixtures: chrome-context group operations, a database reader through an extension page, a restart helper, and one capabilities builder shared with `wdio.conf.ts`. Record the observations in design.md.

## 7. Spec and verification

- [x] 7.1 Amend `RESEARCH_GRAPH_EXTENSION_SPEC.md`: the manifest permissions, and a note on `tabId` and closing the previous node in a tab.
- [x] 7.2 Run `npm run verify` and `openspec validate add-tab-capture`.
