# Research Graph Extension

A local-only browser extension for capturing and synthesising a research session as a graph.
`RESEARCH_GRAPH_EXTENSION_SPEC.md` holds the long-term design; this repository currently contains the
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

`npm run dev` opens Firefox with the extension already installed, so there is nothing to load by
hand. It keeps its Firefox profile in `.firefoxProfile/` (git-ignored) between runs, together with
what the extension stored there: Ollama set up and checked, sessions, page access. Delete that
directory to start over, or run `npm run dev:fresh` for a new throwaway profile that keeps
nothing, as a first-time user would see it. The dev server is pinned to `127.0.0.1:3100` with `strictPort`, not WXT's
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
   actor. All of this is isolated in `e2e/fixtures/firefoxToolbar/`.

### Offline by default, network by request

`npm run verify` touches no network. That matters because this project's subject is a model download:
if the main gate depended on Hugging Face being reachable and fast, a bad minute on a CDN would look
like a broken build.

So the suite is split. The default run installs nothing and asserts only what can be known offline —
that the surfaces render, that the toolbar opens the popup, and that the add-on reports what the
runtime can do. One further spec reaches the hub for real and is **skipped unless you ask for it**:

```bash
E2E_NETWORK=true npm run test:e2e
```

That run downloads the bundled profiles, verifies every file, runs each model's conformance suite and
measures throughput, printing the figures. It is the only thing that can answer whether the
package's declared `connect-src` covers every storage and CDN host a download redirects to — so it
also prints what the policy refused, which the add-on collects in its background context and shows
on the options page.

Expect it to take minutes rather than seconds, and expect to be online.

### Forcing the software compute path

The options page lets you choose which compute path a model runs on, and the default is the software
one. That is deliberate: the manifest declares a minimum Firefox that has no hardware-accelerated
path on any platform, so a figure from the accelerated path describes a machine the add-on does not
require. **Judge the budgets by the software number.**

To make the accelerated path unavailable altogether — useful for confirming that a measurement really
came from the software one — start Firefox with WebGPU off:

```bash
E2E_HEADED=true npm run test:e2e   # then, in about:config, set dom.webgpu.enabled to false
```

To watch the e2e run in a visible browser instead of headless:

```bash
E2E_HEADED=true npm run test:e2e
```

To drive a build other than the packaged production one — the dev build, for instance — point the
suite at its zip:

```bash
E2E_EXTENSION_ZIP=/path/to/build.zip npx wdio run e2e/wdio.conf.ts
```

## Local AI with Ollama (optional)

The extension works on its own. [Ollama](https://ollama.com) is an optional, free app that runs AI
models on your computer: with it, finding similar pages is faster, and page summaries become
possible. Nothing leaves your computer — the extension talks to Ollama only at
`http://127.0.0.1:11434`, the one address besides the model hosts its policy admits.

### Setting it up, if you have never used anything like it

Open the extension's settings — **Settings** at the bottom of the popup — and open **Faster local AI
with Ollama (optional)**. Choose **Set up Ollama** and allow access when Firefox asks. A short
checklist then walks you through the rest, and each step ticks itself when it is done:

1. **Install Ollama.** Follow the _Download Ollama_ link and install it like any other app (on a Mac,
   drag it to Applications).
2. **Open Ollama.** Open it like any other app. There is no window: a llama icon appears in the menu
   bar (on Windows, by the clock).
3. **Allow this extension** — only if the checklist asks. Ollama answers only apps it trusts, so it
   has to be told once to trust this extension. The checklist shows one command, made for your
   computer, with a **Copy** button and where to paste it (on a Mac: open _Terminal_, paste, press
   Return). The command names only this extension, keeps working after a restart, and reopens
   Ollama for you.
4. **Turn on local AI.** One button downloads the recommended model through Ollama (about 274 MB),
   checks its quality, and switches it on.

### Page summaries, if you want them

Once local AI is on, the same section offers **Page summaries (optional)**. They let the extension
write summaries and comparison tables from the pages you read. **Turn on page summaries** downloads a
second, larger model through Ollama — `qwen3:4b`, about 2.5 GB — checks that it extracts facts
correctly and stops when told, and switches it on. Check that your computer has the free disk space
first.

With summaries on, **Measure extraction time** has the model fill a small comparison table from a
test page of about 1,500 words, and shows how long it took against the 20-second budget and how many
of the table's 15 values it got right: green when both are good, amber when it was fast enough but
got some wrong, red when it was too slow. The first measurement includes Ollama loading the model;
measure again for the usual figure.

If Ollama is closed later nothing breaks: pages are still recorded, the popup says local AI is
paused, and the pages waiting for similarity are processed once Ollama is open again. If the
checklist asks to allow the extension again — after reinstalling the extension, or if Ollama started
before the setting at login — run the command it shows once more.

### For developers

The model list, `ollama pull`, `ollama serve` and a throughput measurement sit under _More_ in the
same section. The e2e suite does not drive a real Ollama: it checks only that the section is offered
as optional and that the policy admits the loopback origin, so a change to this path is checked by
hand against a running Ollama.

## Project layout

See [AGENTS.md](AGENTS.md) for the module layering rules and conventions. Planning artifacts for
in-flight work live under `openspec/changes/`.
