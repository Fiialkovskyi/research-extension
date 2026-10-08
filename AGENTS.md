# Repository Guidelines

## Project Structure & Module Organization

The extension source lives in `src/`, organised in four layers that may only import downward
(`entrypoints` → `app` → `features` → `shared`):

- `src/entrypoints/` — browser-facing entry points in WXT's convention. `popup/index.html` plus
  `popup/main.tsx`, which only mounts the React tree; no logic belongs here.
- `src/app/` — one composition root per surface (`popupApp/` today).
- `src/features/` — user-facing capabilities, each split into `model/` (pure logic) and `ui/`
  (components). A feature's `index.ts` is its only public surface; nothing outside may reach past it.
- `src/shared/` — reusable primitives: `ui/` components, `config/` constants, `styles/` the single
  Tailwind entry stylesheet.

Every entity is a directory whose `index.ts` / `index.tsx` is its public surface, with its unit test
beside it as `index.spec.ts(x)`. Add a capability by adding a directory, not by widening a barrel.

**A function's name starts with a verb.** A bare noun reads as a value and hides that calling it
does work, so `getExtensionUrl`, not `extensionUrl`. Which verb carries meaning of its own:

| Prefix                       | For                                                    | Example                                             |
| ---------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| `get`                        | deriving or looking up a value                         | `getToolbarWidgetId`, `getPopupPanelState`          |
| `build`                      | assembling a structure — a payload, a script, a config | `buildPopupReaderScript`, `buildProfilePreferences` |
| `parse` / `read` / `resolve` | turning one representation into another                | `parsePanelState`, `readFirefoxZipAsBase64`         |
| `is` / `has`                 | a predicate returning a boolean                        | `isCanonicalUuid`, `isFirefoxPackage`               |
| `assert`                     | a check that throws and returns nothing                | `assertPlacedOnNavBar`                              |
| plain imperative             | an action with an effect                               | `clickToolbarAction`, `closePopup`                  |

React components are the exception: they are named for the thing they render (`Panel`, `Greeting`),
in PascalCase, from a camelCase directory.

**Names are camelCase, and a directory is named after what it exports.** Directories and files use
camelCase throughout — no kebab-case, and no capital initial, components included. A module that
exports `isCanonicalUuid` lives in `isCanonicalUuid/`, so a reader finds a function by walking to
the directory that bears its name. Tool-owned filenames keep their conventional spelling
(`wdio.conf.ts`, `vitest.config.ts`, `index.html`), and grouping directories that export nothing of
their own (`app`, `features`, `shared`, `fixtures`, `specs`) are named for what they hold.

**One exported function per file.** A module's `index.ts` exports a single function (or a single
component). When that function needs helpers, and nothing else uses them, they go in a `utils/`
nested beneath it — each helper a directory of its own, named after itself, with its own `index.ts`
and `index.spec.ts`:

```
firefoxToolbar/             # no logic of its own: index.ts only re-exports
├── index.ts
├── constants.ts
├── readPopup/
│   ├── index.ts            # readPopup, and nothing else
│   ├── index.spec.ts
│   └── utils/              # helpers only readPopup uses
│       ├── buildPopupReaderScript/
│       ├── interpretReaderResult/
│       └── parsePopupSnapshot/
└── closePopup/
    ├── index.ts
    └── index.spec.ts
```

A `utils/` directory appears only to hold helpers private to one function. A group of sibling
functions is not "utils" — it is the module, and its `index.ts` re-exports them. A helper that a
second module starts using is no longer private: lift it to sit beside its callers. The depth of a
helper therefore records how far it is shared, and nesting stops being arbitrary.

Do not freeze a function's result into a module-level constant for convenience, and do not wrap a
call in a narrower function for convenience either — call the function where the value is needed,
with the argument that case requires (`getExtensionUrl(POPUP_PATH)`, not a `popupUrl()` wrapper). A
wrapper also inverts the directory tree: the general helper ends up nested under the special case
that happened to need it first. A precomputed instance hides that a value is derived, fixes it at import
time, and gives the module a second export that has to be kept in step with the first.

A type belongs to the function that defines its shape — declare it in that function's file and let
callers import it from there, rather than collecting types in a separate file. A value used by more
than one file in a module lives in that module's `constants.ts`; one used by a single file stays in
that file. Logic that touches the live browser is kept thin, with the pure parts it needs — script
construction, payload building, response parsing — extracted as helpers so they carry unit tests.

End-to-end tests live in `e2e/` (WebdriverIO config, Firefox fixtures, specs) and never under `src/`.
A fixture follows the same atomic rule as `src/`: each helper is a folder under its `utils/` with an
`index.ts` and its `index.spec.ts` beside it, and the fixture's own `index.ts` is a re-export surface
with no logic — it sits at `utils/index.ts` rather than at the fixture root, where a pure re-export
file would read as the fixture itself. The same rules on `constants.ts` and on keeping live-browser
logic thin, above, apply here too.
Build output lands in `.output/`, WXT's generated types in `.wxt/`; both are ignored by git.

`Research Graph Extension Spec.md` is the long-term target design, not the current state. Planning
artifacts for in-flight work live in `openspec/changes/<change>/`.

## Build, Test, and Development Commands

Run from the repository root:

| Command                           | What it does                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | `wxt -b firefox` — launches Firefox with the extension loaded and HMR (needs `web-ext`, installed as a dev dependency) |
| `npm run build:firefox`           | Production build into `.output/firefox-mv3/`                                                                           |
| `npm run zip:firefox`             | Packages the build (and a sources zip) into `.output/`                                                                 |
| `npm run typecheck`               | `tsc --noEmit` over `src/`, then over `e2e/` (two programs)                                                            |
| `npm run lint` / `lint:fix`       | oxlint                                                                                                                 |
| `npm run format` / `format:check` | oxfmt                                                                                                                  |
| `npm run test` / `test:watch`     | Vitest unit run / watch                                                                                                |
| `npm run test:e2e`                | Packages for Firefox, then drives it with WebdriverIO                                                                  |
| `npm run verify`                  | typecheck → lint → format:check → test → test:e2e                                                                      |

Run `npm run verify` before submitting changes.

## Coding Style & Naming Conventions

oxfmt owns formatting (its defaults, including double quotes) and oxlint owns linting; run both
rather than hand-formatting. Directories and files are camelCase, named after what they export (see
above); the exported component itself keeps its PascalCase identifier. TypeScript runs in
strict mode with `noUncheckedIndexedAccess`; imports within `src/` use the `@/` alias, and imports
inside a single entity use relative paths. Auto-imports are deliberately disabled in `wxt.config.ts`
— write imports explicitly.

## Testing Guidelines

Two layers, with no overlap in file patterns:

- **Unit** — Vitest with jsdom and Testing Library. The test sits beside the module it covers as
  `index.spec.ts(x)`, in `src/` and in the e2e harness's own helpers alike. Vitest collects
  `src/**/*.spec.{ts,tsx}` and `e2e/**/*.spec.ts`, never `*.e2e.ts`.
- **End-to-end** — WebdriverIO with Mocha against the locally installed Firefox, headless. The suite
  packages the extension, installs it temporarily into a throwaway profile, clicks the real toolbar
  icon, and reads the popup through Firefox's chrome context.

Name tests for the behaviour under test. Everything that touches Firefox UI internals
(`CustomizableUI`, panel ids, the Marionette actor used to read the popup's DOM) stays inside
`e2e/fixtures/firefoxToolbar/` so a Firefox change breaks one file rather than the suite. Do not
claim checks passed unless they were run.

## Commit & Pull Request Guidelines

No Git history exists yet to establish a convention; use short, imperative subjects (for example,
`Add popup greeting`). Pull requests should explain the change and its motivation, list the
validation performed (`npm run verify` output), link related issues, and include screenshots for
user-facing visual changes.

## Security & Configuration

The package ships all of its own code: no remote scripts, stylesheets, or runtime fetches. The
Firefox manifest declares `data_collection_permissions: ["none"]`, and the extension must not
acquire network behaviour without an explicit change to the `extension-shell` spec. Keep credentials
and machine-specific settings out of version control.
