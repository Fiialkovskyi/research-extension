# Proposal

## Why

A page on the capture denylist — a bank, a health or government site, webmail, a password manager, or a site the user added — leaves no trace in a session: no node, no signal, no text, and no notice. That is the promise, but the user cannot see it kept. Someone who opens their bank in a session's tab group, and then sees the usual "Added to research" notice on every other page, has no way to tell the bank was skipped on purpose rather than missed. A short notice on those pages — "this site is not tracked" — says so where the user is looking.

## What Changes

- WHEN a tab of an active session loads a page from a denylisted site (bundled list or the user's own), the extension shows a short notice in the page's top-right corner: the page is not recorded, and the session's name.
- It shows once per site per session until the browser or the background is restarted, so moving around a bank's pages does not repeat it.
- It is turned off by the same Options switch as the "Added to research" notice, whose label now names both.
- The extension still records nothing about the page, not even that the notice was shown: the notice is drawn by a script that reads nothing from the page, sends nothing and stores nothing, and "shown once" is remembered in memory only.
- Tabs outside a session, private windows and pages that are not web pages (`about:`, the extension's own pages) get no notice.

## Capabilities

### New Capabilities

- `blocked-site-notice`: when and how a denylisted page says it is not tracked, and what the extension keeps about it (nothing).

### Modified Capabilities

None.

## Impact

- `tabCapture` (telling a denylisted web page from one that is merely not a web page), `pageNotice` (a second notice wording and a function that decides whether to show it), a new runtime-registered content script that draws the notice, `backgroundApp` (inject it into a denylisted session tab after a navigation, answer its one request), `pageSignals` (a request type), the Options switch label.
- No storage change, no new permission, no network behaviour. The new script is registered at runtime like the observer, so the manifest declares no content script.
- The notice runs a script of the extension in a denylisted page. It reads no page content and sends one fixed request. This is stated in the design and the spec so the denylist's promise, "no trace", is kept to the letter: no node, signal, text, metadata or stored record.
