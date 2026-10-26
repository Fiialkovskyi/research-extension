# Design

## Context

`isCapturableUrl(url, blockedSites)` refuses a page that is not `http`/`https` or whose host is on the bundled denylist or the user's list. `recordNavigation` calls it for a session tab's navigation and, when it refuses, records nothing (it closes the tab's previous node). The page observer is injected into captured pages only (`injectPageObserver`), so a denylisted page runs no extension script. The "Added to research" notice is drawn by `showPageNotice` inside the observer; the background asks for it with `requestNotice` after the text is stored, if the user's `isPageNoticeEnabled` setting is not off. Observed in `isCapturableUrl`, `recordNavigation`, `handleNavigationCommitted`, `injectPageObserver`, `showPageNotice`, `isPageNoticeEnabled`.

## Goals / Non-Goals

**Goals:**

- The user sees, on the page, that a denylisted site in a session tab is not tracked.
- The denylist's promise is kept: no node, signal, text, metadata or stored record of the visit.
- Quiet: once per site per session, same switch as the other notice.

**Non-Goals:**

- Saying which category matched or why. The notice says the site is not tracked; the denylist editor and the spec say why.
- A notice for tabs outside a session, or for non-web pages.
- A list of the blocked sites visited. That would be a record of the visit.
- A setting separate from the existing switch.

## Decisions

### 1. Tell "blocked" from "not a web page"

A new `readBlockedHost(url, blockedSites)` in `tabCapture` returns the host when the URL is an `http`/`https` page on a denylisted host (bundled or user list), and `undefined` otherwise, including for `about:`, `moz-extension:` and `data:`. `isCapturableUrl` stays as it is. The function shares the host matching with `isCapturableUrl` (`isDenylistedHost`), so a host cannot be blocked by one and not the other.

### 2. The background decides; the page script only draws

On a top-frame navigation of a session tab that `recordNavigation` refuses, the background asks `readBlockedNavigation` (in `tabCapture`) whether it is a blocked page in a non-private tab of an active session; it answers from the URL, the tab's group and the session, and stores nothing. Only then does the background check the switch and its in-memory set, inject a new script, `blockedNotice.content`, with the same `executeScript` call the observer uses, and send it `pageNotice.show` with `kind: "blocked"` and the session's title. Injection fails quietly on a page that may not be scripted. The script holds no list, reads nothing from the page and sends nothing to the background: it listens for that one request and draws the notice. Because the background decides, a page cannot ask for the notice for a host that is not blocked.

### 3. "Shown once" is remembered in memory, not stored

Writing the host of a bank to the database would be a record of the visit. So the set `(sessionId, host)` lives in a module-level `Set` in the background. Cost: the event page is unloaded and the set is lost, so the notice may show again after a long pause. Accepted: a repeat is a harmless reminder, and a record is not.

### 4. The notice

The same shape as the "Added to research" notice (`buildNotice`): closed shadow root, same placement, duration and reduced-motion handling, click-through, replaced rather than stacked; a grey dot instead of a green one, the heading "Not tracked" and the second line "This site is not recorded in <session>". `buildNotice` and `showPageNotice` take a `kind` (`added` by default, or `blocked`) that picks the wording and the dot, so the existing notice is unchanged. The sub-line reads "This site is not recorded in <session>".

### 5. The existing switch covers both

`isPageNoticeEnabled` is read for both notices. The Options label becomes "Show a short notice in the corner of a page when it is added to research, or when it is not tracked." The setting's name and storage do not change.

### 6. No separate content-script registration

`blockedNotice.content` is a WXT content script with `registration: "runtime"` and no `matches`, like the observer: the manifest declares no content script and no new host permission, and it runs only where the background injects it.

## Risks / Trade-offs

- **Our script runs on a bank page.** It reads nothing, sends nothing and draws a shadow-root notice; page scripts cannot read it (closed shadow root) and no page text is touched. A user who does not want even that can turn the switch off, which stops the injection (the switch is checked before injecting, not only when answering). Stated plainly in the Options text.
- **A repeat after the background unloads.** Accepted (decision 3).
- **A page that blocks injection (CSP is not a barrier for extension scripts, restricted pages are).** Quiet failure, no notice.
- **A notice on a site the user wanted skipped silently.** The switch.

## Open Questions

- Should the notice name the category ("banking")? Left out; it is more to show and to get wrong.
