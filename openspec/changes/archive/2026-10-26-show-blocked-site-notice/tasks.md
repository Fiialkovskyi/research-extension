# Tasks

## 1. Telling a blocked page from a page that is not a web page

- [x] 1.1 Add `readBlockedHost(url, blockedSites)` to `tabCapture`: the host of an `http`/`https` URL on the bundled or the user's denylist, otherwise `undefined`; verify specs for a bundled domain and subdomain, a listed word, a user-added site, `about:`, `moz-extension:`, `data:`, an invalid URL and an ordinary host, and that it agrees with `isCapturableUrl` on every blocked host.

## 2. The notice

- [x] 2.1 Give `buildNotice` a heading and a sub-line as inputs, with the existing notice's wording passed by its caller; add the "Not tracked" wording and a grey dot; verify specs that the existing notice is unchanged and the new one reads "Not tracked", the sub-line and the session title.
- [x] 2.2 Add a runtime-registered content script `blockedNotice.content` (wiring only) over `listenForBlockedNotice` in `pageSignals`, which answers only `pageNotice.show` with `kind: "blocked"`, reads nothing and sends nothing; add `kind` to the `pageNotice.show` message and `injectBlockedNotice`; verify specs for the listener (a blocked request shows it, everything else is ignored) and for the injection.

## 3. The background

- [x] 3.1 Add `readBlockedNavigation` to `tabCapture`: for a top-frame navigation, the session and host when the page is on the denylist in a non-private tab of an active session, otherwise `undefined`, storing nothing; verify specs for a bundled and a user-added site, a page not on the list, a non-web page, a frame, a tab outside a session, a private tab, no active session (the browser is not asked) and that nothing is stored.
- [x] 3.2 In `handleNavigationCommitted`, when `recordNavigation` records nothing for a top-frame navigation, tell a blocked page once per site and session (a set in memory only), if the switch is on: inject `blockedNotice.content`, then request the notice; verify `backgroundApp` specs: shown for a blocked site and a user-added one, once per site, not for an ordinary page, `about:`, a tab outside a session, with the switch off nothing is injected, a page that may not be scripted asks for nothing, and the database holds no node, snapshot or mention of the host.

## 4. The switch and docs

- [x] 4.1 Change the Options switch label to cover both notices; verify the component spec.
- [x] 4.2 Add an e2e spec: with a session active, load a page on a user-added blocked host from the page server, see the notice, load another page of the host and see none, check the database holds no node for it, and turn the switch off to see none on a second blocked host; run it and report.
- [x] 4.3 Document in `RESEARCH_GRAPH_EXTENSION_SPEC.md` (a note on REQ-SEC-007 and the roadmap line) and run `openspec validate show-blocked-site-notice`.
- [x] 4.4 Run `npm run verify` and report the result faithfully.
