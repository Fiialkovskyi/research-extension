# 1. Project structure

Where code lives, and why there. Most of the rules here can be checked with `find` and `grep`, and
that is the point: a reader should be able to locate any function by walking the tree, without
searching, and a reviewer should be able to spot a misplaced file from the path alone.

- [1.1 The repository root](#11-the-repository-root)
- [1.2 Layers and import direction](#12-layers-and-import-direction)
- [1.3 The entity: one directory, one export](#13-the-entity-one-directory-one-export)
- [1.4 File kinds](#14-file-kinds)
- [1.5 Barrels](#15-barrels)
- [1.6 `utils/`](#16-utils)
- [1.7 `constants.ts`, `schemas.ts` and `types.ts`](#17-constantsts-schemasts-and-typests)
- [1.8 Layer by layer](#18-layer-by-layer)
- [1.9 The e2e tree](#19-the-e2e-tree)
- [1.10 Naming files and directories](#110-naming-files-and-directories)
- [1.11 Where does new code go?](#111-where-does-new-code-go)
- [1.12 Known deviations](#112-known-deviations)

## 1.1 The repository root

```
.
├── AGENTS.md                         # short rules, read first
├── README.md                         # what the project is, how to run it
├── Research Graph Extension Spec.md  # long-term target design, not the current state (to be renamed)
├── LLMReserch.md                     # findings of the inference spike (to be renamed)
├── docs/codeGuide/                   # this guide
├── openspec/
│   ├── specs/                        # capability specs, the current agreed behaviour
│   └── changes/<change>/             # planning artifacts for in-flight work
├── src/                              # the extension
├── e2e/                              # end-to-end suite (WebdriverIO), never under src/
├── scripts/                          # Node scripts run by npm (e.g. syncOnnxRuntime.ts)
├── public/                           # copied verbatim into the build (public/ort/ is generated)
├── wxt.config.ts                     # build and manifest
├── vitest.config.ts, vitest.setup.ts # unit tests
├── tsconfig.json                     # src/ program; e2e/tsconfig.json extends it
├── .oxlintrc.json, .oxfmtrc.json     # lint and format
├── .output/                          # build output — ignored
└── .wxt/                             # WXT's generated types — ignored
```

Root-level files are tool-owned or project-level documents. Nothing in the root is imported by
`src/`; code that would be shared between `src/` and `scripts/` belongs in `src/shared/`.

## 1.2 Layers and import direction

`src/` has four layers. A layer may import only from layers below it:

```
entrypoints  →  app  →  features  →  shared
```

| Layer          | May import from                     | Must not import from                |
| -------------- | ----------------------------------- | ----------------------------------- |
| `entrypoints/` | `app/`, `features/`, `shared/`      | another entrypoint                  |
| `app/`         | `features/`, `shared/`              | `entrypoints/`, another app         |
| `features/`    | `shared/`, another feature's barrel | `app/`, `entrypoints/`              |
| `shared/`      | other `shared/` modules             | `features/`, `app/`, `entrypoints/` |

**Why downward only.** `shared/` is what everything trusts to be stable. The moment `shared/rpc`
imports a feature, every change to that feature can break every context, and `shared/` stops being
a foundation. The same reasoning applies one level up: a feature that imports `app/` can no longer be
tested without the composition root.

**Features may use each other**, but only through the other feature's `index.ts`, and never in a
cycle. Today the graph is a straight line that follows the model pipeline:

```
modelInstall → modelRegistry → modelConformance → inference
inferenceBenchmark → inference
```

If a new import would close a loop, the shared piece belongs in `shared/` — that is usually what the
loop is telling you.

**Imports inside one entity are relative; everything else uses `@/`.**

```ts
// src/features/modelInstall/model/installModel/index.ts
import { readRepositoryJson } from "./utils/readRepositoryJson"; // same entity → relative
import { buildModelManifest } from "@/features/modelRegistry"; // another feature → @/ and barrel
import { getHuggingFaceFileUrl } from "@/shared/huggingFace"; // shared → @/ and barrel
```

Inside one module — a feature, a `shared/` module, a fixture — entities import each other by
relative path (`../downloadModelFiles`); a module never imports its own barrel. A relative path
that climbs out of the module (`../../../otherFeature`) is always wrong: that import goes through the
other module's barrel.

## 1.3 The entity: one directory, one export

The unit of structure is an **entity**: a directory that exports exactly one function or one
component, named after it.

```
installModel/
├── index.ts        # export const installModel = …   — and nothing else
└── index.spec.ts   # its unit test
```

- The directory name **is** the export name: `installModel/` exports `installModel`,
  `modelList/` exports `ModelList`. You find a function by walking to the directory that bears its
  name.
- The test sits beside the code as `index.spec.ts(x)`. No `__tests__/`, no `test/` tree.
- Types the function defines, and helpers only it uses, live inside the same directory
  (see [1.6](#16-utils) and [1.7](#17-constantsts-schemasts-and-typests)).

**One exported function per file.** If you want to export a second function from an `index.ts`, you
want a second entity. Add a directory, do not widen the file.

**Grouping directories export nothing of their own.** `app/`, `features/`, `shared/`, `model/`,
`ui/`, `utils/`, `fixtures/`, `specs/` are named for what they hold, not for an export. A grouping
directory that has an `index.ts` uses it only to re-export (see [1.5](#15-barrels)).

## 1.4 File kinds

Only these file names appear under `src/` and `e2e/`. A file with any other name is either
tool-owned (listed below) or misplaced.

| File                | Contains                                                                                                | Has a spec?                          |
| ------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `index.ts`          | One exported function — or, in a barrel, only re-exports                                                | Yes, when it holds logic             |
| `index.tsx`         | One exported React component                                                                            | Yes                                  |
| `index.spec.ts(x)`  | Unit tests for the `index` beside it                                                                    | —                                    |
| `constants.ts`      | Plain values shared by more than one file of a module                                                   | **No**                               |
| `constants.spec.ts` | Guards on an invariant of the values beside it — rare, see [1.7](#17-constantsts-schemasts-and-typests) | —                                    |
| `schemas.ts`        | Every valibot schema — an entity's own, or a module's shared ones                                       | No — covered through their consumers |
| `types.ts`          | Types, when a file would otherwise declare more than two                                                | No                                   |
| `main.tsx`          | Entrypoint mount code (WXT convention)                                                                  | No — wiring only                     |
| `index.html`        | Entrypoint page (WXT convention)                                                                        | No                                   |
| `*.e2e.ts`          | End-to-end spec, under `e2e/specs/` only                                                                | —                                    |
| `*.css`             | Only `shared/styles/tailwind.css`                                                                       | —                                    |

Tool-owned names keep their conventional spelling: `wdio.conf.ts`, `vitest.config.ts`,
`wxt.config.ts`, `tsconfig.json`.

## 1.5 Barrels

A **barrel** is an `index.ts` that only re-exports. Every feature has one, every `shared/` module
has one, and every e2e fixture has one (at `utils/index.ts`).

```ts
// src/features/modelRegistry/index.ts
/**
 * What a model *is*: which ones ship, what they are pinned to, what they
 * declare about themselves, and which one a feature may use.
 * …
 */

export { modelRegistryRequestSchemas, modelRegistryResponseSchemas } from "./constants";
export type { ModelRegistryRequestType, ModelRegistryResponseType } from "./constants";
export { activateModel } from "./model/activateModel";
export type { ActivateModelOptions } from "./model/activateModel";
export { getActiveModel } from "./model/getActiveModel";
```

Rules:

1. **No logic.** A barrel contains `export … from` lines and comments. No functions, no constants,
   no side effects.
2. **It is the only public surface.** Nothing outside the module imports past it —
   `@/features/modelRegistry`, never `@/features/modelRegistry/model/getActiveModel`. The two
   exceptions follow.
3. **It opens with a doc comment** that says what the module is for, what it deliberately does not
   do, and where it sits in the pipeline when it does. This is the first thing a reader opens; it is
   the module's README.
4. **Types are re-exported with `export type`**, next to the value they belong to.
5. **A capability is added by adding a directory**, then one line to the barrel — not by putting
   more into an existing file.

### Exception 1: a module that pulls in a heavy runtime

A re-export is also a bundling instruction. Re-exporting a module that imports a heavy runtime
drags that runtime into every bundle that touches the barrel. Exporting the inference provider from
`features/inference/index.ts` once took the background bundle from 24 kB to 72 MB, because the
background imported the barrel for its protocol types.

Such a module:

- is **left out of the barrel**, and imported **by path** from the one context that runs it;
- is named in a **comment in the barrel** saying why it is absent — otherwise the next tidy-up puts
  it back.

```ts
// src/features/inference/index.ts
// `model/createExtOrtProvider` is deliberately absent from this barrel: it
// imports the model runtime, and anything that re-exports it drags tens of
// megabytes into every bundle that touches this feature — the background
// included, which needs only the protocol types. The worker imports it by
// path, so the cost lands in the one context that runs models.
```

### Exception 2: a feature's components

A feature's barrel exports its logic, its schemas and its types — **not its components**. The
surface that renders a component imports it by path:

```ts
// src/app/optionsApp/index.tsx
import { ModelList } from "@/features/modelRegistry/ui/modelList";
```

The reason is the same as above, at a smaller scale. The background imports feature barrels for
schemas and model logic; a component in the barrel would put React, and whatever the component
imports, in the background's bundle, where nothing renders. Keeping components out makes the barrel
safe for every context to import.

- Only an `app/` root (or another component) imports from `features/<feature>/ui/<component>`.
- A type that a component defines (`InstallState` in `ui/installProgress`) is imported from the same
  path.
- The barrel says so, once, at the end of its doc comment:

```ts
/**
 * …
 *
 * Components are not exported here: the surface that renders one imports it
 * from `ui/` by path, so the background can import this barrel without React.
 */
```

These are the **only** two ways past a barrel. A by-path import that neither explains is a
deviation.

## 1.6 `utils/`

`utils/` holds helpers that are **private to one public function or component**.

### Who may have a `utils/`

Only a **public entity**: a function or component that its module's barrel exports, or an
`app/` composition root. Private helpers never get one.

There is exactly **one level** of `utils`. A path with two `utils` segments does not exist.

```
src/features/modelInstall/model/
├── installModel/                 # public — exported by the feature's barrel
│   ├── index.ts
│   ├── index.spec.ts
│   └── utils/
│       ├── getModelTreeUrl/      # private to installModel
│       │   ├── index.ts
│       │   └── index.spec.ts
│       └── readRepositoryJson/
│           ├── index.ts
│           └── index.spec.ts
└── downloadModelFiles/
    └── utils/
        └── removeStoredFiles/
```

### A helper's helper sits flat beside it

When a private helper needs a helper of its own, that helper goes into the **same** `utils/`,
beside it — not into a new `utils/` under the helper.

```
collectPolicyViolations/
├── index.ts
├── index.spec.ts
└── utils/
    ├── buildBlockedRequest/   # index.ts calls this
    └── readOrigin/            # only buildBlockedRequest calls this — still flat
```

Not `utils/buildBlockedRequest/utils/readOrigin/`. Nesting by who-calls-whom reads as a hierarchy
the code does not have, and one flat listing shows every private helper of a module at once.

### When a helper stops being private

Sharing is recorded by **where** a helper lives, not by how deep it sits.

| Who calls it                              | Where it lives                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| One public entity (and its other helpers) | That entity's `utils/`                                                   |
| A second entity in the same module        | Lifted out of `utils/` to sit beside its callers, e.g. `model/<helper>/` |
| A second feature, or `app/` and a feature | Out of the feature: `shared/`                                            |

Lift it in the same change that adds the second caller. Importing another entity's `utils/` by path
is never the answer.

### What `utils/` is not

- **Not a bucket for sibling functions.** A group of related public functions is the module itself,
  and its `index.ts` re-exports them. `shared/rpc/` is a module, not `shared/utils/rpc/`.
- **Not a place for wrappers.** Do not create a narrower helper that calls a general one with a
  fixed argument — call the general function with the argument where it is needed. A wrapper also
  inverts the tree: the general helper ends up nested under the special case that needed it first.

## 1.7 `constants.ts`, `schemas.ts` and `types.ts`

### `constants.ts`

- Holds **plain values** — literals, lookup tables, paths, limits — used by **more than one file** of
  a module. A value used by one file stays in that file.
- Holds **no schemas** (they go in `schemas.ts`) and **no types**, including types derived from
  schemas (they follow the `types.ts` rule below).
- Holds **no functions**, and no computed result frozen into a constant for convenience
  (`const popupUrl = getExtensionUrl(POPUP_PATH)` at module level is not allowed — call the function
  where the value is needed).
- **Has no spec — as a rule.** A test that re-asserts a literal
  (`expect(POPUP_PATH).toBe("popup.html")`) changes in lockstep with it and can never fail on its
  own. Put coverage on the function that consumes the value, where its effect is observable.
- **The exception is a guard.** When a value carries an invariant that a type cannot express and a
  mistake would be costly, a `constants.spec.ts` beside it may check that invariant — and only that.
  A guard holds for any correct value and fails for a wrong one; a re-assertion holds for exactly
  one value.

```ts
// src/shared/config/modelProfiles/constants.spec.ts — guards, allowed
it.each([...BUNDLED_MODEL_PROFILES])("pins $repository to a commit rather than a branch", …);
it("names a package-relative directory, never a remote origin", …); // onnxRuntime

// a re-assertion, not allowed
expect(Object.keys(ONNX_RUNTIME_WASM_VARIANTS)).toEqual(["wasm", "webgpu"]);
```

- Lives at the module's root (`features/<feature>/constants.ts`, `shared/<module>/constants.ts`), or
  at an e2e fixture's root.

### `schemas.ts`

- **Every valibot schema lives in a `schemas.ts`** — never inline in a function's file, even when
  only that file uses it. A schema is a description of data, and keeping descriptions apart from the
  code that applies them means a reader finds every shape the project accepts by opening
  `schemas.ts` files.
- **Where:** a schema used by one entity goes in that entity's `schemas.ts`, beside its `index.ts`.
  A schema used by several files of a module goes in the module's `schemas.ts`, at its root.
- Holds **no types**. `v.InferOutput<typeof schema>` and `keyof typeof schemas` are types and follow
  the `types.ts` rule; once a module has a `schemas.ts`, its derived types almost always cross the
  two-type threshold and live in `types.ts`.
- Has **no spec of its own**. A schema is exercised where it is applied — `parseRpcMessage`, the
  background's dispatch, a reader of a hub response — and that is where a test can show that a bad
  shape is refused.

```
src/features/modelRegistry/model/buildModelManifest/utils/parseModelTree/
├── index.ts        # parseModelTree — applies treeSchema
├── index.spec.ts
└── schemas.ts      # treeEntrySchema, treeSchema — used by this entity only

src/features/inference/
├── index.ts
├── constants.ts   # INFERENCE_WORKER_PATH, INFERENCE_REQUEST_TIMEOUT_MS, SUPPORTED_QUANTIZATIONS
├── schemas.ts     # workerRequestSchemas, workerResponseSchemas, inferenceRequestSchemas …
└── types.ts       # EmbedRequest, LoadedModel, WorkerPong, InferenceRequestType …
```

### `types.ts`

A type lives **in the file of the function that defines its shape**, and callers import it from
there:

```ts
// src/features/modelRegistry/model/activateModel/index.ts
export interface ActivateModelOptions { … }
export const activateModel = async (options: ActivateModelOptions) => { … };
```

**When a file would declare more than two types**, all of them move to a `types.ts` beside it. Two
is the threshold: a function with its options and its result reads fine in one file; a third type is
the point where the shapes start to crowd out the logic.

- **Every type counts**: `interface`, `type`, and types derived from a schema
  (`v.InferOutput<typeof schema>`, `keyof typeof schemas`). Re-exports do not count.
- `types.ts` sits **in the same directory** as the file whose types it holds — an entity's
  `types.ts` beside its `index.ts`, a module's `types.ts` beside its `constants.ts`.
- Types with no owning function — the shapes of a config module, a feature's protocol — follow the
  same rule: at most two inline, otherwise `types.ts`.
- `types.ts` contains only types. No values, no schemas.

```
src/shared/config/modelProfiles/
├── index.ts       # barrel
├── constants.ts   # MINILM_L6_V2, BGE_SMALL_EN_V1_5, BUNDLED_MODEL_PROFILES …
└── types.ts       # ModelProfile, EmbeddingProfileContract, …
```

## 1.8 Layer by layer

### `src/entrypoints/`

Browser-facing entry points in WXT's convention. **Wiring only**: mount a tree, or register
listeners and forward to a composition root. Logic belongs in `features/`, where it carries tests.

```
entrypoints/
├── background/index.ts        # defineBackground — registers listeners synchronously
├── inferenceWorker/index.ts   # defineUnlistedScript — loaded as a dedicated Worker
├── popup/
│   ├── index.html
│   └── main.tsx               # createRoot(...).render(<PopupApp />)
└── options/
    ├── index.html
    └── main.tsx
```

- The directory name is the entrypoint's name in the build (`popup.html`, `inferenceWorker.js`), so
  it is chosen for that, not for an export.
- No `utils/`, no `constants.ts`. If an entrypoint needs a helper, the helper is logic and belongs in
  a feature or in the composition root.
- A spec beside an entrypoint (`inferenceWorker/index.spec.ts`) is allowed when the entrypoint does
  its own dispatch, as the worker does.

### `src/app/`

One **composition root** per surface: `popupApp/`, `optionsApp/`, `backgroundApp/`. A root owns
dispatch and takes everything the browser provides as a dependency, so the full path a message
travels is unit tested without an extension runtime.

```
app/optionsApp/
├── index.tsx                        # OptionsApp
├── index.spec.tsx
└── utils/
    └── reduceOptionsState/          # private to OptionsApp
```

- A root may have a `utils/` like any public entity.
- Roots do not import each other. Something two roots need is a feature or a `shared/` module.

### `src/features/`

User-facing capabilities. Each feature is a module with a fixed shape:

```
features/modelRegistry/
├── index.ts          # barrel, with the module doc comment
├── constants.ts      # plain values shared by its files (optional)
├── schemas.ts        # valibot schemas shared by its files (optional)
├── types.ts          # the module's types, once there are more than two (optional)
├── model/            # pure logic — one entity per function
│   ├── activateModel/
│   ├── buildModelManifest/
│   │   └── utils/
│   │       ├── buildModelContract/
│   │       ├── parseModelTree/
│   │       └── readModelLimits/
│   └── getActiveModel/
└── ui/               # components — one entity per component
    └── modelList/
        ├── index.tsx
        └── utils/
            └── getReadableSize/
```

- `model/` is for logic, `ui/` for components. A feature may have only one of them — `inference`
  has no `ui/`, `diagnostics` has no `model/`.
- Nothing else sits at the feature root: no loose `.ts` files besides `index.ts`, `constants.ts`,
  `schemas.ts` and `types.ts`.
- A component's directory is camelCase (`modelList/`); the component itself is PascalCase
  (`ModelList`).

### `src/shared/`

Reusable primitives that several features read. Every entry in `shared/` is one of two things, and
its name says which:

| Kind              | Named as | Shape                                                                    | Imported as                        | Examples                                                               |
| ----------------- | -------- | ------------------------------------------------------------------------ | ---------------------------------- | ---------------------------------------------------------------------- |
| **Module**        | a noun   | barrel + entities, optionally `constants.ts` / `schemas.ts` / `types.ts` | `@/shared/rpc`                     | `rpc/`, `storage/`, `huggingFace/`, `modelManifest/`, `config/`, `ui/` |
| **Single entity** | a verb   | one function, like any entity                                            | `@/shared/collectPolicyViolations` | `collectPolicyViolations/`, `getErrorMessage/`                         |

So every import of `shared/` is `@/shared/<name>` — one segment, never deeper. The only file reached
by a longer path is the stylesheet.

**`shared/config/`** — the extension's configuration: values, not logic. One module with one barrel;
each topic is a subdirectory that holds files, not an entity, so it has no `index.ts` of its own.

```
src/shared/config/
├── index.ts                  # barrel: re-exports every topic below
├── extension/
│   └── constants.ts          # EXTENSION_ID, POPUP_PATH, OPTIONS_PATH …
├── modelProfiles/
│   ├── constants.ts          # MINILM_L6_V2, BUNDLED_MODEL_PROFILES …
│   ├── constants.spec.ts     # guards: pinned to a commit, licence declared
│   └── types.ts              # ModelProfile, EmbeddingProfileContract …
└── onnxRuntime/
    ├── constants.ts
    ├── constants.spec.ts     # guard: never a remote origin
    └── types.ts
```

```ts
import { BUNDLED_MODEL_PROFILES, POPUP_PATH } from "@/shared/config";
```

**`shared/ui/`** — reusable components. One module; each component is an entity, and the barrel
lists them. Only surfaces and components import it, so React in this barrel costs nothing.

```
src/shared/ui/
├── index.ts          # export { Panel } from "./panel";
└── panel/
    ├── index.tsx
    └── index.spec.tsx
```

**`shared/styles/`** — the single Tailwind entry stylesheet, `tailwind.css`, imported for its side
effect by each surface's `main.tsx` (`import "@/shared/styles/tailwind.css"`). No other CSS file
exists in `src/`, and the directory has no barrel because there is nothing to export.

A module moves into `shared/` when a second feature, or `app/` and a feature, starts to need it —
not in anticipation.

## 1.9 The e2e tree

```
e2e/
├── wdio.conf.ts
├── tsconfig.json
├── specs/
│   ├── popupOpens.e2e.ts
│   └── optionsSurface.e2e.ts
└── fixtures/
    └── firefoxToolbar/
        ├── constants.ts          # Firefox-internal ids, selectors, keys
        └── utils/
            ├── index.ts          # barrel: readPopup, closePopup, clickToolbarAction …
            ├── readPopup/
            │   ├── index.ts
            │   └── index.spec.ts
            ├── buildPopupReaderScript/   # private to readPopup — flat, not in the barrel
            ├── parsePopupSnapshot/       # private to readPopup — flat, not in the barrel
            ├── closePopup/
            └── clickToolbarAction/
```

- **Specs** are `e2e/specs/<behaviour>.e2e.ts`. Vitest never collects `*.e2e.ts`; WebdriverIO
  collects nothing else.
- **A fixture's root holds only `constants.ts` and `utils/`.** Every helper is an entity in
  `utils/`, and `utils/index.ts` is the fixture's barrel. A barrel at the fixture root would read
  as the fixture's own logic; under `utils/` it is plainly a list.
- A fixture's `utils/` **is** its one level of `utils`. A helper that only `readPopup` uses sits
  flat beside `readPopup` and is left out of the barrel — never in `readPopup/utils/`.
- Specs import from the barrel: `import { readPopup } from "../fixtures/firefoxToolbar/utils";`.
- Anything touching Firefox internals (`CustomizableUI`, panel ids, the Marionette actor) stays
  inside `fixtures/firefoxToolbar/`, so a Firefox change breaks one fixture rather than the suite.
- Each fixture helper gets a unit test beside it, like `src/`. Live-browser code is kept thin; the
  pure parts — script construction, payload building, response parsing — are separate helpers.

## 1.10 Naming files and directories

- **camelCase everywhere**: directories and files. No kebab-case, no capital initial — component
  directories included (`ui/modelList/`, not `ui/ModelList/`).
- **Markdown files are the exception: `UPPER_SNAKE_CASE.md`.** Upper case marks a document as
  something to read rather than something to import, and sorts documents together in a listing:
  `README.md`, `AGENTS.md`, `docs/codeGuide/PROJECT_STRUCTURE.md`. Words are separated by `_` —
  never spaces, which break shell commands and links. The directory that holds them is still
  camelCase (`docs/codeGuide/`). Markdown whose name a tool fixes keeps it: OpenSpec's
  `proposal.md`, `design.md`, `tasks.md`, `spec.md`, and `SKILL.md` and command files under
  `.claude/` and `.agents/`.
- **A directory is named after what it exports**: `isCanonicalUuid/` exports `isCanonicalUuid`.
- **Function directories start with a verb**: `getActiveModel/`, `buildModelManifest/`,
  `parseRpcMessage/`, `assertFileDigest/`. The verb table is in the Naming section.
- **Module directories are nouns**: `rpc/`, `storage/`, `modelRegistry/`, `config/`.
- **Component directories are nouns** naming what they render: `modelList/`, `installProgress/`.
- **Tool-owned names** keep their spelling: `wdio.conf.ts`, `vitest.config.ts`, `index.html`.

## 1.11 Where does new code go?

Work down the list and stop at the first match.

1. **Does it only register a listener, mount a tree or forward a message?**
   → `entrypoints/<context>/`.
2. **Does it route messages or assemble a surface out of features?**
   → that surface's root in `app/<surface>App/`, with private helpers in its `utils/`.
3. **Is it a helper used by exactly one public function or component?**
   → that entity's `utils/<helper>/`. If the entity is itself a private helper, go to its owner's
   `utils/` and sit beside it.
4. **Is it a new public function of a capability that already exists?**
   → `features/<feature>/model/<function>/` (or `ui/<Component>` → `ui/<component>/`), plus one line
   in the barrel.
5. **Is it a new capability?** → a new `features/<feature>/` with a barrel and its doc comment.
6. **Do two features, or a feature and `app/`, need it?** → `shared/`: into an existing module if
   one fits, otherwise a new single-entity directory (verb) or a new module (noun).
7. **Is it a value?** → the file that uses it; the module's `constants.ts` once a second file does;
   `shared/config/<topic>/constants.ts` if it configures the extension as a whole.
8. **Is it a valibot schema?** → always a `schemas.ts`: the entity's own if one entity uses it, the
   module's if several files do.
9. **Is it a type?** → the file of the function that defines its shape; `types.ts` beside it once
   that file would hold more than two.
10. **Is it a test helper for e2e?** → an entity in `e2e/fixtures/<fixture>/utils/`.

## 1.12 Known deviations

Found mechanically on 2026-10-09. Fix each when the file is next touched; delete the line when you
do.

**More than two types inline, or types in `constants.ts`** (count of declared types):

- `src/features/inference/constants.ts` — 13, mixed with schemas → `inference/types.ts` and
  `inference/schemas.ts`
- `src/shared/modelManifest/constants.ts` — 9
- `src/shared/storage/constants.ts` — 6
- `src/app/backgroundApp/index.ts` — 4
- `src/features/modelRegistry/constants.ts` — 3
- `src/features/diagnostics/constants.ts` — 3
- `src/shared/rpc/parseRpcMessage/index.ts` — 3
- `src/features/inference/model/createInferenceWorker/index.ts` — 3
- `src/app/optionsApp/utils/reduceOptionsState/index.ts` — 3
- `src/features/inferenceBenchmark/constants.ts`, `modelConformance/constants.ts`,
  `modelInstall/constants.ts` — 2 each, but in `constants.ts`, which holds no types

**Schemas outside a `schemas.ts`:**

- In a module's `constants.ts`: `src/features/inference/`, `inferenceBenchmark/`, `diagnostics/`,
  `modelInstall/`, `modelRegistry/`, and `src/shared/modelManifest/`.
- Inline in an entity's `index.ts`: `src/shared/rpc/parseRpcMessage/` (`envelopeSchema`),
  `src/features/modelRegistry/model/resolveModelRevision/` (`revisionResponseSchema`),
  `src/features/modelRegistry/model/buildModelManifest/utils/parseModelTree/` (`treeEntrySchema`,
  `treeSchema`), `…/buildModelManifest/utils/readModelLimits/` (`configSchema`,
  `tokenizerConfigSchema`).

**`shared/config/` not yet one module:** each topic has its own `index.ts` holding the values, there
is no `shared/config/index.ts`, and 21 imports use `@/shared/config/<topic>`.

**`shared/ui/` has no barrel:** `src/app/popupApp/index.tsx` imports `@/shared/ui/panel`.

**Specs on constants:** `src/shared/config/modelProfiles/index.spec.ts` and
`src/shared/config/onnxRuntime/index.spec.ts` become `constants.spec.ts`. In the latter, "ships a
variant for each compute path we measure" re-asserts a literal and goes; the other two are guards.

**Feature barrels without the component note:** `diagnostics`, `inferenceBenchmark`, `modelInstall`
and `modelRegistry` have components in `ui/` but their barrel comments do not say why the components
are absent. `src/features/greeting/index.ts` exports `Greeting` from its barrel.

**Imports past a barrel that no exception covers:** `src/entrypoints/inferenceWorker/index.ts`
imports `features/inference/constants` and `features/inference/model/getRuntimeCapabilities` by
path. Only `createExtOrtProvider` is covered by the barrel's comment.

**e2e fixtures not in the `utils/` layout:** all three — `e2e/fixtures/firefoxExtension/`,
`firefoxToolbar/`, `optionsSurface/` — keep their helpers and barrel at the fixture root, and
`firefoxToolbar` nests private helpers in `<helper>/utils/` (`readPopup`, `clickToolbarAction`,
`getPopupPanelState`, `placeToolbarAction`, `setSystemColourScheme`), as does
`firefoxExtension/selectFirefoxPackage/utils/`.

**Markdown not in `UPPER_SNAKE_CASE.md`:** `Research Graph Extension Spec.md` →
`RESEARCH_GRAPH_EXTENSION_SPEC.md`, `LLMReserch.md` → `LLM_RESEARCH.md` (also fixing the spelling).
Both are referenced from `AGENTS.md` and `README.md`, which change in the same commit.
