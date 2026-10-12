# Repository Guidelines

## Project Structure & Module Organization

This file is the short version. The detailed rules, with examples and the list of places where the
code still deviates from them, are in [`docs/codeGuide/`](docs/codeGuide/README.md). Directories and
files are camelCase; Markdown documents are `UPPER_SNAKE_CASE.md`.

The extension source lives in `src/`, organised in four layers that may only import downward
(`entrypoints` → `app` → `features` → `shared`):

- `src/entrypoints/` — browser-facing entry points in WXT's convention: `popup/`, `options/`,
  `background/` (the MV3 event page) and `inferenceWorker/` (an unlisted script loaded as a
  dedicated Worker). **Entrypoints are wiring only.** They mount a tree, or register listeners and
  forward to a composition root; logic belongs in `features/`, where it carries unit tests. Two
  rules follow from the contexts themselves:
  - The **background** registers every listener synchronously, before any `await`. Firefox runs an
    MV3 background as an event page and unloads it freely, so a listener attached later misses the
    message that woke the page. It is also the only context that writes local storage, so a surface
    asks it to write rather than writing itself.
  - The **inference worker** touches no `browser.*` API. Work arrives over `postMessage` and answers
    leave the same way, which keeps the browser surface in one context and the worker testable by
    inspection.
- `src/app/` — one composition root per surface (`popupApp/`, `optionsApp/`, `backgroundApp/`). A
  root owns dispatch and takes everything the browser provides as a dependency, so the path a
  message travels is exercised in unit tests without an extension runtime.
- `src/features/` — user-facing capabilities, each split into `model/` (pure logic) and `ui/`
  (components). A feature's `index.ts` is its only public surface; nothing outside may reach past it,
  with two exceptions: a module that pulls in a heavy runtime (below), and the feature's components,
  which the barrel never exports — the surface that renders one imports it from `ui/` by path, so
  the background can import any feature barrel without React.
- `src/shared/` — reusable primitives, each imported as `@/shared/<name>` and never deeper: `ui/`
  components, `config/` constants (one module, one barrel, a subdirectory per topic), `styles/` the
  single Tailwind entry stylesheet, `rpc/` the typed message envelope every context speaks,
  `storage/` the versioned local database and its forward-only migrations, and `modelManifest/` the
  shape of an installed model. The last two hold types that several features read, which is why they
  sit here rather than beside any one of them.

Every entity is a directory whose `index.ts` / `index.tsx` is its public surface, with its unit test
beside it as `index.spec.ts(x)`. Add a capability by adding a directory, not by widening a barrel.

### How a model becomes a vector

The layering above says what may import what; it does not say what happens in which order. This is
the one path that crosses most of the codebase, so it is worth reading once before changing any part
of it. Each step names the module that owns it.

1. **A profile says which model.** `shared/config/modelProfiles` — repository, pinned commit, which
   weight file, and the contract values a repository does not publish about itself (pooling,
   normalization, role prefixes).
2. **The reference is pinned.** `modelRegistry/resolveModelRevision` resolves a branch to a
   40-character commit exactly once. Nothing re-resolves it later: a model must keep meaning the same
   weights for as long as it is installed.
3. **The model is described.** `modelRegistry/buildModelManifest` reads the repository's own
   configuration files for what they publish — dimensionality, token limits — and the hub's file
   listing for each file's size and digest. The profile supplies only what is published nowhere.
4. **Files are fetched and verified.** `modelInstall/downloadModelFiles` fetches one at a time with
   no credentials and checks each digest **before** storing it. Any failure removes everything the
   attempt wrote. `modelInstall/installModel` orchestrates steps 2–4 and records the model
   **inactive, conformance pending**.
5. **The model is loaded.** `inference/loadModelIntoWorker` reads the verified bytes out of storage
   and sends them to the worker, which hands them to `inference/model/createExtOrtProvider`. The
   runtime's own cache is replaced by one serving exactly those files, and its remote loading is
   switched off — so a file the cache does not hold is a failed load, never an unchecked download.
6. **The model is judged.** `modelConformance` embeds the bundled probe texts through the loaded
   model and decides whether its output matches the contract it declared.
7. **Only then may it be used.** `modelRegistry/activateModel` activates it if and only if step 6
   passed, recording the reason when it did not. Feature code reaches a model through
   `modelRegistry/getActiveModel`, by family — never by repository.

Two invariants hold across the whole path, and both are easy to break by accident:

- **Nothing reaches the runtime unverified.** Step 4 is what makes that true, and step 5's two
  settings are what keep it true. A convenience that let the runtime fetch a file itself would
  quietly undo both.
- **A model is unusable until it has been judged.** Step 4 records it inactive on purpose. Marking
  it usable at install time would let a model that cannot honour its contract reach a feature.

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

**A module that pulls in a heavy runtime stays out of its feature's barrel.** A feature's `index.ts`
is its public surface, but a re-export is also a bundling instruction: exporting the inference
provider from `features/inference/index.ts` pulled the whole model runtime into the background, which
needs only the protocol types, and took that bundle from 24 kB to 72 MB. Such a module is imported by
path from the one context that runs it, and the barrel carries a comment saying why it is absent —
otherwise the next tidy-up of the exports puts it back.

A `utils/` directory appears only to hold helpers private to one function. A group of sibling
functions is not "utils" — it is the module, and its `index.ts` re-exports them.

**`utils/` is one level and never nests inside another `utils/`.** A helper that a helper needs sits
flat beside it in the same directory:

```
collectPolicyViolations/
├── index.ts
├── index.spec.ts
└── utils/
    ├── buildBlockedRequest/   # index.ts calls this
    └── readOrigin/            # only buildBlockedRequest calls this — still flat
```

Not `utils/buildBlockedRequest/utils/readOrigin/`. Nesting by who-calls-whom reads as a hierarchy
the code does not have, and a path with two `utils` segments tells a reader nothing the first one
did not. One level keeps every private helper of a module visible in a single listing.

Sharing is recorded by _where_ a helper lives, not by how deep it sits. A helper that a second
function in the same module starts using is already in the right place. One that a second module
starts using is no longer private: lift it out of `utils/` to sit beside its callers, and out of the
feature entirely once a third reaches for it.

Do not freeze a function's result into a module-level constant for convenience, and do not wrap a
call in a narrower function for convenience either — call the function where the value is needed,
with the argument that case requires (`getExtensionUrl(POPUP_PATH)`, not a `popupUrl()` wrapper). A
wrapper also inverts the directory tree: the general helper ends up nested under the special case
that happened to need it first. A precomputed instance hides that a value is derived, fixes it at import
time, and gives the module a second export that has to be kept in step with the first.

A type belongs to the function that defines its shape — declare it in that function's file and let
callers import it from there. When a file would declare more than two types (schema-derived ones
included), all of them move to a `types.ts` beside it. A value used by more than one file in a
module lives in that module's `constants.ts`, which holds plain values only; one used by a single
file stays in that file. Every valibot schema lives in a `schemas.ts` — the entity's own when one
entity uses it, the module's when several files do — never inline. Neither file holds types. Logic
that touches the live browser is kept thin, with the pure parts it needs — script construction,
payload building, response parsing — extracted as helpers so they carry unit tests.

End-to-end tests live in `e2e/` (WebdriverIO config, Firefox fixtures, specs) and never under `src/`.
A fixture follows the same atomic rule as `src/`: each helper is a folder under its `utils/` with an
`index.ts` and its `index.spec.ts` beside it, and the fixture's own `index.ts` is a re-export surface
with no logic — it sits at `utils/index.ts` rather than at the fixture root, where a pure re-export
file would read as the fixture itself. The same rules on `constants.ts` and on keeping live-browser
logic thin, above, apply here too.
Build output lands in `.output/`, WXT's generated types in `.wxt/`; both are ignored by git.

`RESEARCH_GRAPH_EXTENSION_SPEC.md` is the long-term target design, not the current state. Planning
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

**Functions are arrow functions assigned to a `const`.**

```ts
export const getToolbarWidgetId = (addOnId: string): string => { … };
```

Not for brevity — for the two things it rules out. A `const` cannot be hoisted, so a module reads in
dependency order rather than letting a call appear above the thing it calls; and it cannot be
redeclared, so a second function of the same name in the same file is an error instead of a silent
replacement.

**React components are the exception** and keep a declaration:

```tsx
export function Panel({ children }: PanelProps) { … }
```

A declaration gives a component its name in stack traces, in React's developer tools and in test
failure output, where an anonymous arrow shows up as `<Unknown>`. They are already the exception for
naming — PascalCase from a camelCase directory — so this is the same exception, not a new one.

**Most of the existing code predates this rule**, so a declaration you find is not evidence the rule
was dropped. Conversion happens as files are touched for other reasons, deliberately rather than as
one sweep: a rename across nearly every file would bury whatever change it travelled with. So write
new functions as arrows, convert the ones you are already editing, and leave the rest alone.

## Testing Guidelines

Two layers, with no overlap in file patterns:

- **Unit** — Vitest with jsdom and Testing Library. The test sits beside the module it covers as
  `index.spec.ts(x)`, in `src/` and in the e2e harness's own helpers alike. Vitest collects
  `src/**/*.spec.{ts,tsx}` and `e2e/**/*.spec.ts`, never `*.e2e.ts`.
- **End-to-end** — WebdriverIO with Mocha against the locally installed Firefox, headless. The suite
  packages the extension, installs it temporarily into a throwaway profile, clicks the real toolbar
  icon, and reads the popup through Firefox's chrome context.

**A module that only declares constants carries no spec of its own.** `constants.ts` and
`schemas.ts` hold values, not logic — a test that just re-asserts a literal
(`expect(POPUP_PATH).toBe("popup.html")`) changes in lockstep with the constant and can never fail on
its own, so it catches nothing a type error would not already catch. Put the coverage on the
function that consumes the constant, where the value's effect is observable instead. The one
exception is a **guard**: when a value carries a costly invariant no type can express — a model
profile pinned to a commit, a runtime path that must never be a remote origin — a
`constants.spec.ts` may check that invariant and nothing else.

Name tests for the behaviour under test. Everything that touches Firefox UI internals
(`CustomizableUI`, panel ids, the Marionette actor used to read the popup's DOM) stays inside
`e2e/fixtures/firefoxToolbar/` so a Firefox change breaks one file rather than the suite. Do not
claim checks passed unless they were run.

## Commit & Pull Request Guidelines

**Never commit, push, create a branch or archive an OpenSpec change unless the maintainer has
explicitly asked for that action in the current request.** Finishing a task, passing
`npm run verify`, or an earlier "yes" to something else is not that request. When work is ready,
leave it uncommitted in the working tree, say that it is ready, and wait for the command.

No Git history exists yet to establish a convention; use short, imperative subjects (for example,
`Add popup greeting`). Pull requests should explain the change and its motivation, list the
validation performed (`npm run verify` output), link related issues, and include screenshots for
user-facing visual changes.

## Security & Configuration

The package ships all of its own code: no remote scripts, stylesheets, or runtime fetches. The
Firefox manifest declares `data_collection_permissions: ["none"]`, and the extension must not
acquire network behaviour without an explicit change to the `extension-shell` spec. Keep credentials
and machine-specific settings out of version control.
