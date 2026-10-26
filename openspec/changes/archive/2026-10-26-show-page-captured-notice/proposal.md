# Proposal

## Why

The extension records pages silently. A user reading in a session cannot tell, without opening the popup, whether the page in front of them was taken into the research or was missed (a denylisted site, a tab outside the group, a session that ended). A short, calm notice on the page itself answers that at the moment it matters, and it makes the recording visible, which is also the honest thing to do for a tool that reads pages.

## What Changes

- When the text of a page in a session has been extracted and stored, show a small notice in the top-right corner of that page: "Added to research" with the session's title, which fades by itself after a few seconds.
- The notice is drawn by the page observer, inside a closed shadow root, so the page's styles and scripts cannot restyle or read it. It takes no focus, does not capture the pointer, and is announced politely to screen readers.
- The background decides when to show it: only once it has stored the page's extracted text, never for a page it has merely visited, a page it does not capture, a page whose text it already holds, or a tab outside a session.
- A setting on the options page turns the notice off. It is on by default.
- Nothing is sent to the page that the page could use: the notice text stays inside the closed shadow root.

## Capabilities

### New Capabilities

- `page-captured-notice`: the in-page notice that a page was taken into the research, when it appears, what it says, how it behaves, and how it is turned off.

### Modified Capabilities

None.

## Impact

- `pageSignals` (a notice module, wired into the observer), the page observer's request schemas, `backgroundApp` (sends the notice once a page's text is stored), the options page (one toggle) and the background-owned settings it writes.
- No new permission: the observer is already injected into session tabs.
- e2e: reading the notice needs the chrome-privileged view of a closed shadow root; the fixture stays under `e2e/fixtures`.
