# 3. TypeScript and functions

How a function is written once you know where it goes ([1](./PROJECT_STRUCTURE.md)) and what it is
called ([2](./NAMING.md)). Formatting is not here: oxfmt owns it, and nothing in this guide
overrides the formatter.

- [3.1 Compiler settings](#31-compiler-settings)
- [3.2 Functions are arrow constants](#32-functions-are-arrow-constants)
- [3.3 Signatures](#33-signatures)
- [3.4 Function bodies](#34-function-bodies)
- [3.5 Types: shapes and unions](#35-types-shapes-and-unions)
- [3.6 `unknown`, `any`, casts and `!`](#36-unknown-any-casts-and-)
- [3.7 `undefined` and `null`](#37-undefined-and-null)
- [3.8 Imports and exports](#38-imports-and-exports)
- [3.9 Classes and module state](#39-classes-and-module-state)
- [3.10 Comments](#310-comments)
- [3.11 Known deviations](#311-known-deviations)

## 3.1 Compiler settings

`tsconfig.json` runs TypeScript with:

| Setting                                | What it means for the code you write                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `strict`                               | No implicit `any`, strict `null` checks, strict function types. The baseline, not a goal.                      |
| `noUncheckedIndexedAccess`             | `array[i]` and `record[key]` are `T \| undefined`. Handle the `undefined`; do not assert it away.              |
| `noImplicitOverride`                   | A method that overrides one in a base class says `override`.                                                   |
| `noUnusedLocals`, `noUnusedParameters` | Dead code does not compile. A parameter a signature requires but the body ignores is prefixed `_` (`_unused`). |

Rules:

- **Never weaken a setting**, globally or per file. If a setting is in the way, the code is telling
  you something.
- **No `@ts-ignore`, `@ts-nocheck`.** `@ts-expect-error` is allowed only in a spec, on a line that
  deliberately passes an invalid value to prove it is refused, with a comment saying so.
- **No lint suppressions in code.** A rule that must be off for a file is turned off in
  `.oxlintrc.json` with an `overrides` entry naming that file — where the exception is visible and
  reviewed (see `no-await-in-loop` for `downloadModelFiles`).

`noUncheckedIndexedAccess` in practice:

```ts
// ✗ hides the case where the file is not there
const weights = files[0]!;

// ✓ the missing case is handled where it arises
const weights = files[0];
if (weights === undefined) {
  throw new Error(`${repository} lists no weight file.`);
}
```

## 3.2 Functions are arrow constants

```ts
export const getToolbarWidgetId = (extensionId: string): string => { … };
```

Not for brevity, for the two things it rules out:

- **No hoisting.** A `const` cannot be called before its definition, so a module reads top to
  bottom in dependency order — helpers first, the export last.
- **No redeclaration.** A second `const` of the same name in a file is a compile error; a second
  `function` silently replaces the first.

This applies everywhere: `src/`, `e2e/`, specs, and functions nested inside other functions.

**React components are the exception** and keep a declaration, because a declaration gives the
component its name in stack traces, React DevTools and test output, where an anonymous arrow shows
up as `<Unknown>`:

```tsx
export function ModelList({ models }: ModelListProps) { … }
```

**Existing declarations** are converted when their file is touched for another reason, not in a
sweep. A declaration you find is not evidence the rule was dropped — see
[3.11](#311-known-deviations).

## 3.3 Signatures

### Return types

Every **exported** function annotates its return type. The annotation is the contract: it stops a
change in the body from silently changing what every caller receives, and it is what a reader
checks first.

```ts
export const resolveModelRevision = async (
  repository: string,
  reference: string,
  fetchResource: typeof fetch,
): Promise<string> => { … };
```

A module-private helper may rely on inference when its body is a single expression.

### Parameters

- **At most three positional parameters**, and only when each has a different type or an obvious
  order (`getCosineSimilarity(left, right)`, `resolveModelRevision(repository, reference, fetchResource)`).
- **More than three, or any optional one, or any boolean → an options object.** Its type is
  `<FunctionName>Options`, declared beside the function, destructured on the first line:

```ts
export interface InstallModelOptions {
  profile: ModelProfile;
  database: IDBPDatabase<ModelDatabaseSchema>;
  fetchResource: typeof fetch;
  onProgress?: (progress: InstallProgress) => void;
}

export const installModel = async (options: InstallModelOptions): Promise<StoredModel> => {
  const { profile, database, fetchResource, onProgress } = options;
  …
};
```

- **No boolean positional flags.** `load(model, true)` says nothing at the call site;
  `load({ model, isWarm: true })` does.
- **Inputs a function does not modify are `readonly`**: `readonly string[]`,
  `ReadonlyArray<ModelFile>`. It documents the promise and lets callers pass `as const` data.

### Dependencies are parameters

Logic in `features/` and `shared/` does not reach for browser globals. What the platform provides —
`fetch`, the database, a clock, a worker, `navigator.gpu` — arrives as a parameter, and the
entrypoint or composition root supplies the real one.

```ts
// ✗ untestable without a network, and silently uses whatever fetch is in scope
const response = await fetch(url);

// ✓ the caller decides; the spec passes a stub
export const resolveModelRevision = async (…, fetchResource: typeof fetch) => { … };
```

The parameter is typed with the platform's own type (`typeof fetch`) or, where that is too wide to
fake, a minimal `…Like` interface declaring only what is used (`GpuLike`).

## 3.4 Function bodies

- **Guard clauses first, the main path last.** Handle each failure or special case with an early
  `return` or `throw`, so the body does not nest:

```ts
if (v.safeParse(commitRevisionSchema, reference).success) {
  return reference; // nothing to resolve
}

const response = await fetchResource(url, { credentials: "omit" });

if (!response.ok) {
  throw new Error(
    `Could not resolve ${repository}@${reference}: the hub answered ${response.status}.`,
  );
}

return parsed.output.sha;
```

- **`const` by default.** `let` only for an accumulator in a loop, or a value assigned inside a
  `try` and used after it. Never `var`.
- **`for…of`, not `.forEach`.** It works with `await`, `break` and `return`, and reads the same
  for arrays and iterables.
- **Independent async work runs together** with `Promise.all`. Sequential `await` in a loop is
  allowed only where the order is the point (one download at a time) and is declared in
  `.oxlintrc.json`.
- **No floating promises.** Every promise is awaited, returned, or explicitly handed off with a
  comment saying why it may run on.
- **Do not freeze a result into a module-level constant for convenience**, and do not wrap a call in
  a narrower function — call the function where the value is needed
  (`getExtensionUrl(POPUP_PATH)`, not a `popupUrl()` wrapper or a `POPUP_URL` constant).

## 3.5 Types: shapes and unions

**`interface` for object shapes, `type` for everything else** — unions, aliases, function types,
mapped and derived types.

```ts
export interface StoredModel { … } // a shape
export type ConformanceStatus = "pending" | "passed" | "failed"; // a union
export type ModelManifest = v.InferOutput<typeof modelManifestSchema>; // derived
```

`type X = { … }` for a plain object shape is not used; an interface reads as "a shape" at a glance
and gives clearer error messages.

**No `enum`.** A set of options is a string-literal union, or a `const` array with the union
derived from it when the values are needed at run time:

```ts
export const MODEL_FAMILIES = ["embedding", "text-generation"] as const;
export type ModelFamily = (typeof MODEL_FAMILIES)[number];
```

**Derive, do not duplicate.** When a schema or a constant already describes a shape, the type comes
from it (`v.InferOutput`, `keyof typeof`, `(typeof X)[number]`). Two hand-written descriptions of
one shape drift apart.

**Discriminated unions for outcomes.** A result that can succeed or fail carries a literal
discriminant, and the code switches on it — the compiler then checks every case:

```ts
// ✗ compiles with { passed: true, reason: "…" } and with { passed: false }
interface Outcome {
  passed: boolean;
  reason?: string;
}

// ✓ each case carries exactly what it means
type Outcome = { passed: true } | { passed: false; reason: string };
```

**`as const`** for literal tables and tuples, so their values keep their literal types.
**`satisfies`** when a value must match a type but should keep its own narrower type.

## 3.6 `unknown`, `any`, casts and `!`

- **No `any`.** Not in signatures, not in casts, not in specs.
- **Anything from outside is `unknown`** — a message from a port, `response.json()`, a value read
  from storage of an older version, a result returned by a script in Firefox's chrome context. It
  becomes a typed value only by passing through a schema (`parse…`, valibot). See the Errors and
  validation section.
- **No non-null assertion `!`.** Handle the `undefined` (see [3.1](#31-compiler-settings)).
- **`as` casts are a last resort** and allowed only in three cases, each with a comment:
  1. narrowing after a runtime check the compiler cannot follow;
  2. a platform type missing from the lib declarations (`navigator.gpu`);
  3. a typed array the runtime returns as a wider type (`output.data as Float32Array`).

```ts
// ✗ a type assertion pretending to be validation
return JSON.parse(raw) as PopupSnapshot;

// ✓ parse means validate
return v.parse(popupSnapshotSchema, JSON.parse(raw));
```

`as const` is not a cast and is always fine.

## 3.7 `undefined` and `null`

**`undefined` is how this codebase says "absent".** Optional fields are `field?: T`; a lookup that
finds nothing returns `undefined`; comparisons are `=== undefined`.

**`null` appears only at the platform boundary**, where an API gives or requires it, and goes no
further:

- DOM and IndexedDB return it: `document.getElementById(…)`, `cursor !== null`.
- React renders nothing with `null`.
- A JSON payload defined by an external format.

Convert at the boundary: a function that reads from such an API returns `undefined` to its callers.

## 3.8 Imports and exports

**Named exports only.** `export default` is used only where a tool requires it — WXT's
`defineBackground` / `defineUnlistedScript`, `wxt.config.ts`, `vitest.config.ts`.

**Type-only imports are marked**, as the `typescript/consistent-type-imports` lint rule enforces:

```ts
import type { IDBPDatabase } from "idb";
import { MODEL_STORE, type ModelDatabaseSchema, type StoredModel } from "@/shared/storage";
```

**Order**, separated as shown:

```ts
import * as v from "valibot"; // 1. packages
import type { IDBPDatabase } from "idb";

import { buildModelManifest } from "@/features/modelRegistry"; // 2. @/ — sorted by path
import { getModelRef } from "@/shared/modelManifest";
import { downloadModelFiles } from "../downloadModelFiles"; // 3. relative — sibling, then own utils
import { getModelTreeUrl } from "./utils/getModelTreeUrl";

import "@/shared/styles/tailwind.css"; // side-effect imports last, entrypoints only
```

**Which path:**

| Importing                                            | Path                                            |
| ---------------------------------------------------- | ----------------------------------------------- |
| Your own `utils/` helper                             | relative: `./utils/getModelTreeUrl`             |
| A sibling entity in the same module                  | relative: `../downloadModelFiles`               |
| Your module's `constants.ts`/`schemas.ts`/`types.ts` | relative                                        |
| Another module                                       | `@/` and its barrel: `@/features/modelRegistry` |

A module never imports its own barrel — that is how import cycles start.

**No `export *`.** A barrel lists what it exports by name, so the public surface is reviewable in
one file.

## 3.9 Classes and module state

**No classes**, with two exceptions:

- An **`Error` subclass** that carries a discriminant a caller branches on
  (`RpcMessageError` with its `rejection`).
- A **test double** that must be a class because the code under test constructs it
  (`FakeWorker` in a spec).

Objects with behaviour are built by a `create…` function that closes over its state and returns
plain methods (`createInferenceWorker`, `createModelFileCache`, `createBackgroundApp`).

**No mutable module-level state** in `features/` or `shared/`: two callers would share it without
knowing. State lives in a closure returned by `create…`. The only module-level `let` allowed is in
an entrypoint that is itself a single instance (the worker's `loaded` model).

## 3.10 Comments

- **Every exported function has a JSDoc block** saying what it guarantees and **why** it is shaped
  the way it is — the decision a reader would otherwise question or undo. Add `@returns` and
  `@throws` when they are not obvious from the name and type.
- **Inline comments explain why, never what.** `// No cookies, no tokens: a model download must not
  carry an identity.` is useful; `// fetch the file` is noise.
- **Every barrel opens with a doc comment** describing the module (see
  [1.5](./PROJECT_STRUCTURE.md#15-barrels)).
- **No commented-out code** and no `TODO` without an OpenSpec change or issue that owns it.

## 3.11 Known deviations

None found on 2026-10-09.
