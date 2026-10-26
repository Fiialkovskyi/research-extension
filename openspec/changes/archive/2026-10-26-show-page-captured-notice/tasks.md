# Tasks

## 1. The setting

- [x] 1.1 Add the notice switch to the background-owned settings (default on) with an RPC to read and set it, alongside the setup banner's state; verify specs for the default, a write, and a read after a restart.
- [x] 1.2 Add the toggle to the options page; verify a component spec that it shows the stored value and asks the background to change it.

## 2. The notice on the page

- [x] 2.1 Add `showPageNotice` to `pageSignals/model`: a closed shadow root host with the text, top-right, non-interactive, `role="status"`, fading in and out, replacing an earlier one, removed after about 3.5 s; verify jsdom specs with fake timers for show, replace, removal, no focus and no pointer events.
- [x] 2.2 Style it for light and dark and for reduced motion; verify a spec for the reduced-motion path; the audit covers the extension's own pages only, so the notice is checked by its unit specs for role, live region and colours.
- [x] 2.3 Add the `pageNotice.show` request to the observer's request schemas and handle it in `observePage`; verify specs that a valid request shows the notice and an invalid one shows nothing.

## 3. The background decides

- [x] 3.1 After the background stores a page's extracted text, send `pageNotice.show` with the session title when the setting is on; verify `backgroundApp` specs for stored text, text from a page the tab has left, the setting off and a page that refuses the notice.
- [x] 3.2 Give the tab-messaging call to the `pageSignals` dependencies, and do not await it into the answer to the page; verify the text is stored when the page refuses the notice.

## 4. End to end and docs

- [x] 4.1 Add an e2e that copies from a page in a session and finds the notice through the chrome view of the closed shadow root, then finds none before the text is taken, none for a tab outside the group and none with the setting off; verify `npm run test:e2e` passes it.
- [x] 4.2 Correct the stale comment on `PAGE_ACCESS_ORIGINS` (access is required and granted at install) and document the notice in `RESEARCH_GRAPH_EXTENSION_SPEC.md`; verify `openspec validate show-page-captured-notice` passes.
- [x] 4.3 Run `npm run verify`; report anything not run.
