# 9. Testing

Two layers with no overlap: unit tests (Vitest) for everything that can run without a browser, and
end-to-end tests (WebdriverIO) for what only a real Firefox can show. Most of the architecture —
injected dependencies, thin entrypoints, composition roots — exists so that the first layer can be
large and the second small.

- [9.1 The two layers](#91-the-two-layers)
- [9.2 What gets a spec](#92-what-gets-a-spec)
- [9.3 Writing a spec](#93-writing-a-spec)
- [9.4 Test names](#94-test-names)
- [9.5 Test data and doubles](#95-test-data-and-doubles)
- [9.6 Components](#96-components)
- [9.7 Storage in tests](#97-storage-in-tests)
- [9.8 End-to-end](#98-end-to-end)
- [9.9 Offline by default](#99-offline-by-default)
- [9.10 Before you submit](#910-before-you-submit)
- [9.11 Known deviations](#911-known-deviations)

## 9.1 The two layers

|                | Unit                                                           | End-to-end                                                                                                  |
| -------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Runner         | Vitest, jsdom, Testing Library                                 | WebdriverIO + Mocha, headless Firefox, geckodriver                                                          |
| Files          | `index.spec.ts(x)` beside the code; `constants.spec.ts` guards | `e2e/specs/<behaviour>.e2e.ts`                                                                              |
| Collected from | `src/**/*.spec.{ts,tsx}`, `e2e/**/*.spec.ts`                   | `e2e/specs/**/*.e2e.ts`                                                                                     |
| Command        | `npm run test`                                                 | `npm run test:e2e` (packages first)                                                                         |
| Proves         | logic, dispatch, rendering, migrations                         | the packaged extension installs, its toolbar icon opens the popup, the options page works in a real browser |

The patterns never overlap: Vitest never collects `*.e2e.ts`, WebdriverIO collects nothing else.

## 9.2 What gets a spec

- **Every entity with logic** has an `index.spec.ts(x)` beside it — public functions, private
  `utils/` helpers, components, reducers, composition roots, e2e fixture helpers.
- **A composition root is tested as a whole**: `createBackgroundApp` is driven with raw messages and
  fake dependencies, `OptionsApp` is rendered with a stub client. That is where a message's whole
  path is proven.
- **No spec** for barrels, `constants.ts`, `schemas.ts`, `types.ts` and pure wiring
  (`entrypoints/background`, `main.tsx`). A guard on constants is the one exception
  ([1.7](./PROJECT_STRUCTURE.md#17-constantsts-schemasts-and-typests)).
- **Code that cannot run in jsdom** (the model runtime in `createExtOrtProvider`) is kept to
  configuration and glue, with every decision moved into tested `utils/`; its module comment says
  why it has no spec.
- **A bug fix starts with a failing spec** that reproduces it.

## 9.3 Writing a spec

- **Import the unit from `"."`** — the spec tests the public surface of its own entity.
- **Import `describe`, `it`, `expect`, `vi` from `vitest`** explicitly; globals are off.
- **Test behaviour, not implementation.** Assert what a caller can observe — the return value, what
  was stored, what was sent, what is on screen — not which private helper was called.
- **One behaviour per `it`.** Several `expect`s are fine when they describe one outcome.
- **Arrange, act, assert**, separated by blank lines. No logic in assertions (no loops or
  conditionals deciding what to expect); use `it.each` for tables of cases.
- **No `.only`, `it.todo`, or unconditional `.skip`** in a commit. The only skip is the network
  gate in [9.9](#99-offline-by-default).
- **Deterministic**: no real time, randomness or network. Inject a clock (`now`), a seed, a
  `fetchResource` stub. `vi.useFakeTimers` only for timeouts the unit sets itself.
- **Failure paths are tested as carefully as success**: a refused payload, a digest mismatch, a hub
  that answers 404, a worker that dies. Assert the message, not only that something threw:

```ts
await expect(resolveModelRevision(repository, "main", stubFetch({ status: 404 }))).rejects.toThrow(
  "the hub answered 404",
);
```

## 9.4 Test names

- `describe` names the unit: the function or component (`"parseRpcMessage"`, `"ModelList"`), or the
  thing a guard spec covers (`"bundled model profiles"`).
- `it` is a sentence about behaviour, in the present tense, that would make sense to someone who has
  not read the code — and, where it is not obvious, says why the behaviour matters:

```ts
it("says plainly that nothing is installed, rather than rendering an empty box", …);
it("shows the pinned revision, which is what makes output reproducible", …);
it("pins $repository to a commit rather than a branch", …); // it.each
```

- Not `"works"`, `"handles error"`, `"returns correct value"`, `"test 1"`.

## 9.5 Test data and doubles

- **Builders** start with `build` and take overrides
  ([2.12](./NAMING.md#212-names-in-specs)):

```ts
const buildModel = (overrides: Partial<InstalledModelSummary> = {}): InstalledModelSummary => ({
  ref: "Xenova/all-MiniLM-L6-v2@751bff37182d3f1213fa05d7196b954e230abad9",
  repository: "Xenova/all-MiniLM-L6-v2",
  …,
  ...overrides,
});
```

- **Doubles** start with `create` and say their kind: `createStubFetch`, `createFakePort`,
  `createStubWorker`. A **stub** returns canned answers; a **fake** is a working lightweight
  implementation (`fake-indexeddb`, a port that delivers messages). Use `vi.fn()` inside them when a
  spec must assert a call.
- **Dependencies are injected, not mocked.** In `src/`, a unit receives `fetchResource`, the
  database, the worker, the clock as parameters, and the spec passes doubles. `vi.mock` of a module
  is not used in `src/`; reaching for it means the unit has a hidden dependency.
- **The one sanctioned module mock** is `vi.mock("@wdio/globals")` in e2e fixture specs, because the
  WebdriverIO `browser` is a global the fixture cannot receive as a parameter.
- **A double may be cast to the platform type once**, inside its `create…` function
  (`as unknown as typeof fetch`), because it implements only what the unit uses. A builder returns a
  correctly typed value without a cast — use `satisfies` or typed literals.
- **Realistic values**: real repository names, 40-character commits, plausible sizes. A spec is also
  documentation of what the data looks like.
- **A spec imports only the unit under test and public surfaces.** It does not reach into another
  entity's `utils/`; a helper it needs from elsewhere is either public or rebuilt in the spec.

## 9.6 Components

- Render with Testing Library's `render`, query with `screen`.
- **Prefer what a person perceives**: `getByRole`, `getByText`. Use `getByTestId` for elements with
  no stable role or text, and to check a state's presence or absence
  (`queryByTestId("model-list")` → `not.toBeInTheDocument()`).
- Interact with `fireEvent` (the project's current choice); assert what the user would see next, or
  what the stub client was sent.
- Assert on `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toBeDisabled`,
  `toHaveTextContent`).
- No snapshot tests: a snapshot asserts everything, so it documents nothing and is updated without
  reading.
- `cleanup` runs after each test from `vitest.setup.ts`; specs do not call it.

## 9.7 Storage in tests

- Specs that touch IndexedDB import `fake-indexeddb/auto` first and open the real database through
  `openModelDatabase` — the same schema and migrations as production.
- **Each test starts clean**: clear the stores it uses in `beforeEach`, or open a uniquely named
  database for migration specs.
- **Migration steps** are tested through `applyModelDatabaseUpgrade`: from a fresh profile and from
  each earlier version, with records present.

## 9.8 End-to-end

- **Specs describe user-visible behaviour** in `e2e/specs/<behaviour>.e2e.ts` and read like it:
  open the popup, check what it shows.
- **All browser mechanics live in fixtures** (`e2e/fixtures/<fixture>/utils/`), with the layout from
  [1.9](./PROJECT_STRUCTURE.md#19-the-e2e-tree). Anything that touches Firefox internals —
  `CustomizableUI`, panel ids, the Marionette actor — stays in `firefoxToolbar`, so a Firefox change
  breaks one fixture rather than the suite.
- **Fixture helpers are unit-tested** like `src/`. The live-browser part is thin; the pure parts —
  script building, result parsing, preference building — are separate helpers with specs.
- **Specs share constants with `src/`** through `@/shared/config` (`EXTENSION_ID`, `POPUP_PATH`)
  rather than repeating literals.
- **Each spec leaves the browser as it found it**: close the popup in `afterEach`, leave the chrome
  context in `after`.
- **Wait for a condition, never for time.** `waitUntil` with a timeout constant, not `pause`.
- Headless by default; `E2E_HEADED=true` shows the browser.

## 9.9 Offline by default

`npm run verify` touches no network: the project's subject is a model download, so a suite that
downloaded would be slow, flaky and dependent on a third party.

- The default e2e run installs nothing and asserts only what can be known offline.
- The network run is opt-in: `E2E_NETWORK=true npm run test:e2e`. It installs real models, runs
  conformance and measures throughput, printing the numbers (the one place `console` is used).
- A spec that needs the network is gated on the variable, so the offline run skips it visibly
  rather than failing:

```ts
const networkSuite = process.env["E2E_NETWORK"] === "true" ? describe : describe.skip;
```

## 9.10 Before you submit

```
npm run verify   # typecheck → lint → format:check → test → test:e2e
```

Do not claim checks passed unless they were run. If one was skipped — no Firefox available, network
run not attempted — say which, in the pull request.

## 9.11 Known deviations

None found on 2026-10-09.
