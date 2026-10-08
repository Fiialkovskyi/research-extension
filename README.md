# Research Graph Extension

A local-only browser extension for capturing and synthesising a research session as a graph.
`Research Graph Extension Spec.md` holds the long-term design; this repository currently contains the
project scaffold and the extension's first surface — a toolbar popup.

**Status:** Firefox MV3 build with a toolbar popup that renders "Hello World". Chrome support,
the sidebar, capture, clustering and local inference are all future work.

## Requirements

- macOS (the only supported development platform at this stage)
- Node.js 22 (developed against v22.14.0) and npm 10
- Firefox installed locally — verified against **157.0**; the manifest declares a minimum of 140.0

## Getting started

```bash
npm install          # also runs `wxt prepare` to generate .wxt/ types
npm run dev          # builds, then opens Firefox with the extension loaded (HMR on)
```

`npm run dev` opens a fresh Firefox profile with the extension already installed, so there is
nothing to load by hand. The dev server is pinned to `127.0.0.1:3100` with `strictPort`, not WXT's
default port 3000: in dev mode the popup fetches its modules over HTTP, and if another project's
server already holds port 3000 on a wildcard address, WXT quietly falls back to `[::1]` while
Firefox resolves `localhost` to `127.0.0.1` and loads the _other_ server's response — the popup then
opens empty. A dedicated port that fails loudly makes that impossible. Click the Research Graph icon in the toolbar: a popup opens showing
"Hello World". It follows your macOS light/dark appearance — switch
**System Settings → Appearance** and reopen the popup to see it change.

If the icon is not on the toolbar, Firefox parked it in the puzzle-piece _Extensions_ menu next to
the address bar; open that menu and pin it. Edits to `src/` reload the popup automatically; press
`o` then Enter in the dev-server terminal to reopen the browser.

## Commands

```bash
npm run typecheck      # tsc over src/, then over e2e/
npm run lint           # oxlint
npm run format         # oxfmt (format:check to verify without writing)
npm run test           # Vitest unit tests, co-located with each module
npm run test:e2e       # packages for Firefox, then drives the real browser
npm run build:firefox  # production build into .output/firefox-mv3/
npm run zip:firefox    # packaged extension + sources zip in .output/
npm run verify         # all of the gates above, in order
```

## How the tests are arranged

Unit tests live beside the module they cover as `index.spec.ts(x)` and run in jsdom. End-to-end tests
live in `e2e/`: the suite packages the extension, installs it temporarily into a throwaway Firefox
profile, **clicks the real toolbar icon**, and reads the popup it opens — including both colour
schemes. Everything runs headless.

Three details worth knowing before changing the e2e harness:

1. Firefox assigns each profile a random internal UUID for an add-on, so the popup's
   `moz-extension://` address would be unknowable. The harness pins it through the
   `extensions.webextensions.uuids` preference (test-only; the shipped manifest declares just the
   add-on id).
2. The toolbar lives in Firefox's chrome context, which Marionette only opens with geckodriver's
   `--allow-system-access` (passed as `allowSystemAccess` in `wdio:geckodriverOptions`). In that
   context `browser.execute` and `$` are useless — they route through BiDi into the content realm —
   so privileged work uses the classic `executeScript` / `findElement` / `performActions` commands.
3. The popup renders in a remote XUL `<browser>`: BiDi does not report it as a browsing context and
   its `contentDocument` is null. The fixture reads it through Firefox's own `MarionetteCommands`
   actor. All of this is isolated in `e2e/fixtures/firefox-toolbar/`.

To watch the e2e run in a visible browser instead of headless:

```bash
E2E_HEADED=true npm run test:e2e
```

To drive a build other than the packaged production one — the dev build, for instance — point the
suite at its zip:

```bash
E2E_EXTENSION_ZIP=/path/to/build.zip npx wdio run e2e/wdio.conf.ts
```

## Project layout

See [AGENTS.md](AGENTS.md) for the module layering rules and conventions. Planning artifacts for
in-flight work live under `openspec/changes/`.
