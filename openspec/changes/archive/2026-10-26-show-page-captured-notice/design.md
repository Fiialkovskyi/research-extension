# Design

## Context

The background injects the page observer (`pageObserver.content`) into a session tab after `recordNavigation` writes a node, asks it for the page's text once the node is deep read, and stores the text it sends back (`content.extracted`). The observer already answers messages from the background (`onRequest`). Only the background writes storage, so a setting is written through it, the way the setup banner's folded state is.

## Goals / Non-Goals

**Goals:**

- The user sees, on the page, that it was taken into the research, without opening anything.
- It never gets in the way: no focus, no clicks captured, gone in seconds, one at a time.
- It cannot be used by the page to learn what was recorded.

**Non-Goals:**

- An undo or "remove this page" action in the notice (a follow-up: it needs pointer events and focus handling that this notice deliberately avoids).
- Notices for anything but a page whose text was just taken (no "saved", "summary ready" or error notices).
- A choice of corner or duration.

## Decisions

### 1. An in-page notice, not a browser notification or a badge

A system notification leaves the page and the reading flow, and would fire for every page. A toolbar badge is already available for counts but is easy to miss. An in-page notice is where the user is looking. It is drawn by the observer because that is the one script already in the page and already allowed there.

### 2. The background asks, once the text is stored

A page is taken into the research when its text is extracted and stored, not when it is merely visited: a page visited for a second is not yet research. So the moment is the background's answer to `content.extracted`, after `recordSnapshot` has stored the text for the tab's current node. The background then checks the setting and sends the observer one `pageNotice.show` message with the session title, without holding the answer to the page back. A page the tab has left, a page whose text is already held (no extraction is asked for), a page the observer could not be injected into, and a tab outside a session all produce no message.

### 3. Closed shadow root, top-right, non-interactive

The host element is appended to the document element with a closed shadow root, so the page cannot read the session title or restyle the notice. It is `position: fixed`, top and right 16 px, the highest z-index, `pointer-events: none` and never focusable, so it cannot trap a click or a key. It carries `role="status"` and `aria-live="polite"`. The page can still notice an element was added; it cannot read what it says. This is accepted.

### 4. Quiet motion and both colour schemes

A short fade in and out; with `prefers-reduced-motion` it appears and disappears without animation. Colours follow `prefers-color-scheme` and keep WCAG AA contrast. The notice stays about 3.5 seconds, and a second notice replaces the first rather than stacking.

### 5. The switch lives in the background's settings

One boolean, on by default, written by the background when the options page asks, and read by the background before it messages the observer. The observer reads no storage.

## Risks / Trade-offs

- **A page may cover the corner** (a sticky header or a cookie banner). The notice sits above everything and does not move; a page that hides it in fullscreen video hides it, which is acceptable.
- **Noise.** Many fast navigations could flash notices. A new notice replaces the old one, and only top-frame pages whose text was just stored show one.
- **Visibility to the page.** The page can see that a host element appeared and when. It cannot read the text.
- **Not covered yet:** a page whose text is already held (the same content read again) shows no notice, since nothing new was taken.
- **Open:** whether single-page-app route changes that store a text should also show a notice; the first version shows one for every stored text and revisits the rate after use.
