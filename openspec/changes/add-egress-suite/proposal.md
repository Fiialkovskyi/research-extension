# Proposal

## Why

The no-egress promise (REQ-SEC-001 to SEC-003) was enforced by the content security policy and
checked by reading code, but no test watched what the add-on actually sends. Section 13 of the
target spec asks for an egress suite. Writing it found a real leak.

**The leak.** Once the user allowed page access, the add-on polled the local Ollama server
(`/api/tags`, `/api/show`) although the user had never connected it. The gate asked
`permissions.contains` for the loopback origin, and `<all_urls>` covers loopback. So allowing page
access counted as connecting Ollama, against REQ-SEC-001a.

## What Changes

- **An egress e2e.**
  - A new fixture, `egressLog`, records every HTTP request whose principal is the add-on: its
    pages, its workers, and the scripts it puts into pages. It does this from Firefox's chrome
    context, through the `http-on-modify-request` observer, so nothing in the add-on needs to
    cooperate.
  - `egress.e2e.ts` first shows that the log sees a request made as the add-on. It then runs a
    whole session:
    - starting it;
    - page access;
    - reading pages;
    - the Synthesis page;
    - a gap's search;
    - the options page.
  - It asserts that the add-on made no request. A top-level tab the add-on opened at the user's
    request, such as a gap's search, is the user's browsing and is not counted.
- **The Ollama gate fixed.** The local server counts as connected only when its own origin is
  among the granted host permissions, which only the options page's "Connect" requests. Page
  access no longer implies it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `extension-shell`: an automated egress check is part of the suite.
- `model-runtime`: allowing page access does not connect the local inference server.

## Impact

- **Code:**
  - `features/ollama/isOllamaAccessGranted`;
  - the background entrypoint's `hasOllamaAccess` reads `permissions.getAll`.
- **Tests:**
  - `e2e/fixtures/egressLog/`, with unit specs for each helper;
  - `e2e/specs/egress.e2e.ts`;
  - a unit spec for the gate.
- **Out of scope:**
  - an egress check of the opt-in network run, which reaches Hugging Face by design;
  - a proxy-level check of Firefox's own traffic, which is not the add-on's.
