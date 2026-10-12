# Tasks

## 1. Permissions

- [ ] 1.1 Declare `permissions: ["tabGroups", "sessions", "tabs", "webNavigation"]` in `wxt.config.ts`, updating its comment (keep the reason for `sessions`). Verify after `npm run build:firefox` that `.output/firefox-mv3/manifest.json` lists exactly those four.

## 2. Graph additions

- [ ] 2.1 `researchGraph/model/updateNodeTitle` with a spec: the title changes; a blank title and a missing node change nothing.
- [ ] 2.2 `researchGraph/model/countSessionNodes` with a spec: counts only the session's nodes, closed ones included.

## 3. Capture model

- [ ] 3.1 Add `src/features/tabCapture/`: `constants.ts` (edge weights), `types.ts` (`TabCaptureApi`, event payloads), the barrel.
- [ ] 3.2 `isCapturableUrl` with a spec: `http`/`https` accepted; `about:`, `moz-extension:`, `file:`, `data:` and unparsable URLs refused.
- [ ] 3.3 `recordNavigation` with a spec: top frame only; reload, private and out-of-group tabs ignored; parent link, `sameTab` edge and parent closed; opener link and edge on a tab's first node only; no active session → nothing.
- [ ] 3.4 `recordTabJoined`, `closeTabNode`, `updateTabTitle`, `recordTabFocus` with specs per the membership, title and focus rules in design.md.
- [ ] 3.5 `reconcileSessionTabs` with a spec: unmatched open nodes closed, matched ones kept, uncaptured group tabs recorded as `restored`.

## 4. Background

- [ ] 4.1 `backgroundApp`: add `TabCaptureApi` to the dependencies and handlers for committed navigation, tab updated, activated and removed, run through the existing `serializeSessionWork` queue, logging a failed handler. `reconcileSession` also reconciles tabs. `session.active` carries `pageCount`. Extend `index.spec.ts`, including the order of a commit and a title update arriving together.
- [ ] 4.2 Entrypoint: register `webNavigation.onCommitted`, `tabs.onActivated` and `tabs.onRemoved` synchronously; widen the existing `tabs.onUpdated` filter to `["groupId", "title"]` and dispatch title changes to capture; pass the real `TabCaptureApi`. Verify with `npm run typecheck`.
- [ ] 4.3 Store each recorded node's id as the per-tab value `researchNodeId`, and link a restored tab's first node to the node it names (design.md, Working alongside session restore), with specs.

## 5. Popup

- [ ] 5.1 Show `· N pages recorded` (`session-page-count`) beside the active session, keeping the closed-session notice (`session-closed`); update `researchSession` schemas and the popup spec.

## 6. End-to-end

- [ ] 6.1 Static page server for `e2e/fixtures/pages/` (`a.html` linking to `b.html`) on `127.0.0.1`, started in `onPrepare` and stopped in `onComplete`. Its pure parts get unit specs.
- [ ] 6.2 A chrome-context fixture that loads a URL into the selected tab, with its script builder unit tested; extend the popup snapshot with the page count.
- [ ] 6.3 e2e scenario: start a session, load `a.html` and then `b.html` in its tab, reopen the popup, and see `2 pages recorded`.
- [ ] 6.4 By hand in `npm run dev`: a link opened in a new tab gets an opener edge; dragging a tab into and out of the group; a restart. Record the outcome, including the open question, in design.md.

## 7. Spec and verification

- [ ] 7.1 Amend `RESEARCH_GRAPH_EXTENSION_SPEC.md`: the manifest permissions, and a note on `tabId` and closing the previous node in a tab.
- [ ] 7.2 Run `npm run verify` and `openspec validate add-tab-capture`.
