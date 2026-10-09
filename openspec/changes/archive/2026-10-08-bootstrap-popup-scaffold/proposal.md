# Proposal

## Why

The repository holds only `Research Graph Extension Spec.md` — a 612-line target design for a Firefox MV3 research-graph add-on — and an empty OpenSpec root. There is no package, no build, no browser artifact, and therefore no way to verify any of that design incrementally. The full spec is months of work and will keep changing, so the first change deliberately buys the smallest end-to-end slice that proves the toolchain: a React + TypeScript + Tailwind extension that a developer can build, load into a local Firefox, and see render.

## What Changes

- Introduce the project toolchain: npm package, WXT (Vite-based web-extension framework), React 19, TypeScript (strict), Tailwind CSS v4, oxlint + oxfmt.
- Produce a Firefox MV3 build whose manifest carries `browser_specific_settings.gecko.id` and `strict_min_version: "140.0"`, matching the target spec's minimum platform.
- Add the extension's first user-visible surface: a toolbar-action **popup** that renders "Hello World", follows the system light/dark theme, and ships no remote code.
- **Deviation from the target spec, deliberate:** the surface is `action.default_popup`, not the `sidebar_action` of the target spec §11. A conventional dropdown popup is the smallest surface that exercises the whole build-and-load path; the sidebar arrives in its own change.
- Establish the module layout every later capability will slot into — `entrypoints` / `app` / `features` / `shared`, one folder per entity with `index.ts(x)` as its public surface and its unit test beside it as `index.spec.ts(x)`.
- Establish two test layers: Vitest unit tests co-located with modules, and a WebdriverIO end-to-end test in `e2e/` that installs the built add-on into a temporary local Firefox profile and asserts the popup document renders.
- Replace the placeholder guidance in `AGENTS.md` with the real layout, commands, and test conventions; add a `README.md` with local macOS onboarding.

## Capabilities

### New Capabilities

- `extension-shell`: How the add-on is packaged and what surface the browser exposes — the Firefox MV3 manifest contract, the toolbar action's popup document, and the no-remote-code guarantee. It will own later surface requirements (sidebar, options page, map tab) as they arrive.

### Modified Capabilities

<!-- None: this is the project's first capability. -->

## Impact

- **New code:** `src/` (popup entrypoint, `app/popup-app`, `features/greeting`, `shared/{ui,config,styles}`), `e2e/` (WebdriverIO config, Firefox fixture, popup spec).
- **New config:** `package.json`, `tsconfig.json`, `wxt.config.ts`, `vitest.config.ts`, `.oxlintrc.json`, `.gitignore`.
- **Docs:** `AGENTS.md` rewritten from placeholder to actual layout and commands; `README.md` added.
- **New dependencies:** wxt, @wxt-dev/module-react, react, react-dom, tailwindcss, @tailwindcss/vite, typescript, vitest, jsdom, @testing-library/react, @testing-library/jest-dom, WebdriverIO stack (@wdio/cli, @wdio/local-runner, @wdio/mocha-framework, @wdio/geckodriver-service, geckodriver), tsx, oxlint, oxfmt.
- **Local prerequisites:** macOS, Node 22, and a local Firefox install (verified against 157.0) for `wxt dev` and the e2e run.
- **Explicitly out of scope:** sidebar, background event page, content scripts, IndexedDB, graph and clustering, any model or inference, native host, Chrome target, CI, git hooks, encryption, and AMO submission.
