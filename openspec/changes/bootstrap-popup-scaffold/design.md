# Design

## Context

Greenfield: the repository has no package, build, or source tree (see `proposal.md` — Why). Everything here is a first choice rather than a change to something existing, so the bias is toward decisions that the later capabilities of `Research Graph Extension Spec.md` — background event page, content scripts, sidebar, map tab, inference worker — can grow into without a rewrite.

Fixed constraints for this change:

- Local macOS development only. Verified locally: Node v22.14.0, npm 10.9.2, Firefox 157.0 in `/Applications`.
- Firefox is the only target now; Chrome follows in a later change, so the build must stay multi-target-capable.
- The repository is not a git repository yet, so nothing may depend on git hooks.

## Goals / Non-Goals

**Goals:**

- One command builds a Firefox-installable package; one command proves the popup renders in a real Firefox.
- A module layout where every entity is a folder with `index.ts(x)` as its only public surface, so later capabilities are added by adding folders, not by editing shared barrels.
- Two clearly separated test layers with no overlap in file patterns: unit beside the module, end-to-end in `e2e/`.
- A stable add-on id and popup path defined once and consumed by both the manifest and the e2e harness.

**Non-Goals:**

- Cross-browser capability layers in the e2e harness. The harness is Firefox-only by decision below.
- Any abstraction for background, storage, messaging, or inference. Those arrive with the capabilities that need them.
- Driving Firefox's unified-extensions panel. The fixture moves the action onto the navigation bar instead of testing wherever Firefox happened to park it.

## Decisions

### Build: WXT rather than hand-rolled Vite or CRXJS

WXT (0.21.x) is a Vite-based framework specific to web extensions: it derives the manifest from an entrypoint convention and builds per target with `-b firefox` / `-b chrome`, and it ships an official React module and a Vitest integration.

- _Alternative — Vite + `@crxjs/vite-plugin` with a hand-written `manifest.json`_: closer to the target spec's wording ("TypeScript, Vite, `web-ext`") and less magic, but the Chrome target, popup HMR, and the Firefox source-zip requirement all become hand-maintained.
- _Alternative — plain Vite with a copied manifest_: maximum control, most boilerplate, and the multi-target story must be invented.

Chosen because "Firefox now, Chrome later" is a stated requirement and WXT makes that a flag rather than a second build.

Configuration choices inside WXT:

- `srcDir: 'src'`, so entrypoints live at `src/entrypoints/` alongside the rest of the source tree.
- `imports: false` — WXT's auto-imports are disabled. Explicit imports keep the atomic module boundaries visible and keep oxlint's import rules meaningful.
- The manifest block supplies `browser_specific_settings.gecko.{id,strict_min_version}` and `action.default_title`; WXT derives `action.default_popup` from the popup entrypoint.

### Styling: Tailwind v4 through its Vite plugin

Tailwind v4 is configured by `@tailwindcss/vite` plus a single `@import "tailwindcss";` stylesheet — no `tailwind.config.js`, no PostCSS chain. The stylesheet is imported from the popup's mount module, so the popup document's CSS is bundled into the package (no remote font or CSS origin, satisfying the no-remote-code requirement).

The system-theme requirement is met with Tailwind's `dark:` variant in its default `prefers-color-scheme` mode; no theme toggle, no stored preference.

### Module layout: four layers, one folder per entity

```
src/
  entrypoints/popup/{index.html,main.tsx}   # browser-facing entry; main.tsx only mounts
  app/popup-app/                            # composition root for the popup surface
  features/greeting/                        # one feature, split model/ and ui/
  shared/{ui,config,styles}/                # reusable primitives and constants
e2e/                                        # harness, fixtures, specs
```

Rules that later changes inherit: an entity is a directory; its `index.ts(x)` is its public surface; cross-entity imports go through that surface; a feature re-exports only what other layers may use; `main.tsx` contains no logic beyond mounting. Imports between layers point downward only (`entrypoints` → `app` → `features` → `shared`).

`src/shared/config/extension` holds `EXTENSION_ID` (`research-graph@example.org`, from the target spec) and `POPUP_PATH` (`popup.html`). `wxt.config.ts` and the e2e fixture both read it, so the id cannot drift between the manifest and the test that addresses the popup by URL.

### Unit tests: Vitest, co-located, `index.spec.ts(x)`

Vitest with the jsdom environment and the WXT Vitest plugin (so tests see the same transformed code as the bundler), Testing Library for component assertions. `include` is `src/**/*.spec.{ts,tsx}` and `e2e/**` is excluded, so the unit run can never pick up a browser spec.

- _Alternative — a central `tests/` tree_: rejected; the stated convention is the test beside the module it covers.

### End-to-end: WebdriverIO + geckodriver, Firefox-only capabilities

Playwright cannot install extensions into Firefox at all, which rules it out despite being the obvious default. Puppeteer can drive Firefox over WebDriver BiDi, but extension installation there is new and thinly documented. WebdriverIO 10 with the geckodriver service exposes `installAddOn(base64, temporary)` directly and documents extension testing, so it is the shortest path to a green test. Capabilities are written for Firefox only, per the decision to defer Chrome.

How the test drives the popup:

1. `wxt zip -b firefox` produces a package under `.output/`; the fixture locates it by glob (`.output/*firefox*.zip`) rather than by a hardcoded filename, so a version bump or a WXT naming change does not break it.
2. The browser profile pins the add-on's internal UUID through the `extensions.webextensions.uuids` preference, mapping `EXTENSION_ID` to a fixed UUID, so the popup's `moz-extension://` address is known and can be asserted.
3. A `before` hook installs the package temporarily (`installAddOn(zip, true)`); temporary installation is what lets an unsigned local build load at all.
4. The suite then clicks the real toolbar icon. geckodriver gets `--allow-system-access` (passed as `allowSystemAccess` through `wdio:geckodriverOptions`), the session switches to Firefox's chrome context, `CustomizableUI.addWidgetToArea` makes sure the action sits on the navigation bar, and a WebDriver pointer gesture clicks it.
5. The popup renders in a remote XUL `<browser>`: BiDi does not report it as a browsing context and its `contentDocument` is null. The fixture reads it through Firefox's own Marionette actor on the popup's window global, returning a snapshot (document URI, greeting text and visibility, panel width, background and text colour).

Three constraints follow from WebdriverIO's protocol split, and the fixture documents them so later work does not rediscover them: `browser.execute` and `$` always route through BiDi into the content realm, so privileged work uses the classic commands (`executeScript`, `findElement`, `performActions`) that honour the moz context; the panel passes through a `showing` state, so every interaction waits for `open`; and the chrome context is unavailable without the geckodriver flag above.

This covers the toolbar gesture, the anchoring (the panel's anchor resolves to the extension's toolbar item), the rendered React tree, and — by flipping `ui.systemUsesDarkTheme` mid-session — both colour schemes. The theme assertions are palette-independent: the two appearances must differ and the greeting must not be painted onto its own background colour.

### Quality tooling: oxlint + oxfmt, nothing else

oxlint 1.x for linting (typescript/react/react-hooks/import plugins, correctness + suspicious), oxfmt for formatting — one Rust toolchain, no ESLint or Prettier. No git hooks and no CI, matching the local-only scope.

Known gap: oxfmt does not sort Tailwind class lists (only `prettier-plugin-tailwindcss` does). Accepted for now; if class ordering becomes noisy, Prettier can be added for that single concern later.

## Risks / Trade-offs

- **WXT 0.21.3+ moved to Vite 8; `@tailwindcss/vite` 4.3 may not match its plugin API** → verify the popup is actually styled in the first build; fall back to `@tailwindcss/postcss` if the Vite plugin misbehaves.
- **WebdriverIO 10 needs a TypeScript loader for its config and specs on Node 22.14 (no native type stripping by default)** → add `tsx` and run wdio with `NODE_OPTIONS='--import tsx'`; verified as part of the e2e task rather than assumed.
- **Firefox BiDi/geckodriver extension support has had regressions historically** → the harness uses geckodriver's documented `installAddOn` path, and the local Firefox version (157.0) is recorded in the README so a future failure can be bisected against it.
- **Pinning the add-on UUID by preference is a test-only trick** → it lives solely in the e2e capabilities; the shipped manifest declares only the add-on id, exactly as the target spec requires.
- **The toolbar fixture depends on Firefox UI internals** (`CustomizableUI`, the `customizationui-widget-panel` id, the `webextension-popup-browser` class, the `MarionetteCommands` actor) → all of it is isolated in `e2e/fixtures/firefox-toolbar/`, so a Firefox change breaks one file loudly rather than leaking through the suite.
- **The popup surface deviates from the target spec's sidebar** → the deviation is recorded in `proposal.md`; `extension-shell` is scoped to own the sidebar requirement when that change lands, so no rework of the capability boundary is needed.
