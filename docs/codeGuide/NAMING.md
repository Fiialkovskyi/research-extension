# 2. Naming

A name is the first, and often the only, documentation a reader gets. In this codebase a name also
does structural work: a directory is named after what it exports ([1.10](./PROJECT_STRUCTURE.md#110-naming-files-and-directories)),
so a badly chosen name puts the code in the wrong place as well as describing it wrongly.

- [2.1 General rules](#21-general-rules)
- [2.2 Functions start with a verb](#22-functions-start-with-a-verb)
- [2.3 The verb dictionary](#23-the-verb-dictionary)
- [2.4 Choosing between close verbs](#24-choosing-between-close-verbs)
- [2.5 Booleans](#25-booleans)
- [2.6 Variables and constants](#26-variables-and-constants)
- [2.7 Schemas](#27-schemas)
- [2.8 Types](#28-types)
- [2.9 Components and handlers](#29-components-and-handlers)
- [2.10 Message types, events and test ids](#210-message-types-events-and-test-ids)
- [2.11 Abbreviations and casing](#211-abbreviations-and-casing)
- [2.12 Names in specs](#212-names-in-specs)
- [2.13 Known deviations](#213-known-deviations)

## 2.1 General rules

- **Say what, not how.** `getActiveModel`, not `queryModelStoreByFamilyFlag`. The body says how;
  the name is what a caller needs to decide whether to call it.
- **Use the domain's words, consistently.** A thing has one name everywhere: a _model_ is never also
  a _network_ or an _engine_; a _profile_ is what we ship, a _manifest_ is what we derived from the
  hub, a _contract_ is what the model promises. Introducing a synonym creates a second concept in
  the reader's head.
- **Spell words out.** `request`, not `req`; `error`, not `err`. The short forms that are allowed are
  listed in [2.11](#211-abbreviations-and-casing).
- **US English** in identifiers, matching the platform (`color-scheme`, `normalize`). Comments and
  documents may use either spelling, but one identifier is never spelled two ways.
- **Length follows scope.** A loop index in a three-line loop can be `index`; an export used across
  features carries every word it needs (`MINIMUM_DETERMINISM_SIMILARITY`).

## 2.2 Functions start with a verb

Every function name starts with a verb — exported or not, in `src/`, `e2e/` and specs alike.

```ts
// ✗ reads as a value; hides that calling it does work
const url = (path: string) => browser.runtime.getURL(path);
const unavailable = (device: InferenceDevice) => …;

// ✓
const getExtensionUrl = (path: string) => browser.runtime.getURL(path);
const isDeviceUnavailable = (device: InferenceDevice) => …;
```

A bare noun reads as a value. When the reader sees `url(path)`, they have to stop and check whether
`url` is a string, a function, or a function that fetches something. `getUrl(path)` answers that
before they ask.

Rules that follow:

- **No `Async` suffix.** The return type says `Promise`; the name says what is done.
  `readInferenceRuns`, not `readInferenceRunsAsync`.
- **No vague verbs**: `do`, `process`, `manage`, `perform`, `execute`, `handle` (except for an event
  handler, see [2.9](#29-components-and-handlers)). They say that something happens, not what.
- **No conversion prefixes** like `toHex` or `asArray`. Pick the verb from the dictionary that says
  what the conversion is: `getHexString`, `parseArray`.
- **The object follows the verb** and is a noun phrase: `build` + `ModelManifest`, `assert` +
  `FileDigest`. Avoid repeating context the module already gives: inside `features/modelInstall`,
  `downloadModelFiles` is right, `downloadModelInstallModelFiles` is not.
- **React components are the exception** — named for what they render (see
  [2.9](#29-components-and-handlers)).
- **React hooks** start with `use`, as React requires (see
  [4.2](./REACT_AND_UI.md#42-components)).

## 2.3 The verb dictionary

Each verb promises something about what the function does. Use the verb whose promise fits; if none
does, pick a precise plain verb (table B) rather than stretching one from table A.

### A. Verbs with a fixed meaning

| Verb       | Promises                                                                                                     | Examples                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `get`      | Returns a value derived or looked up from its inputs. No lasting effect; may be async.                       | `getActiveModel`, `getCosineSimilarity`, `getExtensionUrl`             |
| `list`     | Like `get`, but returns a collection.                                                                        | `listInstalledModels`                                                  |
| `build`    | Assembles a plain structure — a payload, a message, a script, a config. Pure.                                | `buildRpcMessage`, `buildModelManifest`, `buildPopupReaderScript`      |
| `create`   | Constructs something with behaviour or a lifecycle — a worker, a cache, a provider, an app — and returns it. | `createInferenceWorker`, `createModelFileCache`, `createBackgroundApp` |
| `parse`    | Turns untrusted or serialized input into a typed value, refusing what does not fit.                          | `parseRpcMessage`, `parseHubFileUrl`, `parseModelTree`                 |
| `read`     | Takes a value out of a source — storage, a DOM, a file, an unknown object — tolerating absence.              | `readInferenceRuns`, `readPopup`, `readMessageField`                   |
| `resolve`  | Turns a reference into what it refers to.                                                                    | `resolveModelRevision` (branch → commit), `resolveFirefoxZip`          |
| `is`/`has` | A predicate. Returns `boolean`, nothing else, no effect.                                                     | `isCanonicalUuid`, `isFirefoxPackage`                                  |
| `assert`   | Checks, throws if the check fails, returns nothing.                                                          | `assertFileDigest`, `assertPlacedOnNavBar`                             |
| `update`   | Changes part of something that already exists, keeping the rest.                                             | _(none yet)_                                                           |
| `set`      | Replaces one value or setting outright.                                                                      | `setSystemColourScheme`                                                |
| `remove`   | Deletes something that exists.                                                                               | `removeStoredFiles`                                                    |
| `record`   | Appends an entry to a log; never changes earlier entries.                                                    | `recordInferenceRun`                                                   |
| `open`     | Acquires a handle or surface that is then used and released.                                                 | `openResearchDatabase`, `openOptionsSurface`                           |
| `reduce`   | A reducer: `(state, event) => state`. Pure.                                                                  | `reduceOptionsState`                                                   |

### B. Plain verbs for actions

Anything else that **does** something is named by the plain imperative verb for it: `install`,
`download`, `load`, `activate`, `measure`, `run`, `collect`, `apply`, `split`, `select`, `click`,
`close`, `enter`, `leave`, `place`, `wait`.

```ts
(installModel,
  downloadModelFiles,
  loadModelIntoWorker,
  activateModel,
  measureEmbeddingThroughput,
  runEmbeddingConformance,
  collectPolicyViolations,
  clickToolbarAction,
  waitForPopupPanel);
```

A plain verb should still be specific. `runEmbeddingConformance` is fine because "running a suite"
is what happens; `runModel` would not be, because it does not say whether the model is loaded,
embedded with or tested.

## 2.4 Choosing between close verbs

These pairs are where names most often go wrong.

**`get` vs `read`.** `get` computes or looks up; `read` takes something out of a source that exists
apart from the call. If the answer depends on what is stored, rendered or written somewhere, it is
`read`; if it depends only on the arguments (or a lookup the caller does not think of as a
source), it is `get`.

```ts
getCosineSimilarity(a, b); // pure computation
readInferenceRuns(database); // what the store holds right now
readMessageField(candidate, "id"); // a field out of an unknown object, may be absent
```

**`read` vs `parse`.** `parse` judges the whole input and refuses it if it does not fit — it
validates. `read` takes what it needs and tolerates the rest.

```ts
parseRpcMessage(candidate, schemas); // rejects any malformed envelope
readMessageField(candidate, "type"); // returns undefined if the field is missing
```

**`build` vs `create`.** `build` returns data you could `JSON.stringify`; `create` returns something
with methods, state or a lifecycle (`terminate`, `dispose`, listeners).

```ts
buildRpcMessage("model.list", {}); // { v, type, id, payload }
createInferenceWorker(url); // a running worker with request()/terminate()
```

**`update` vs `set`.** `update` merges a change into an existing record and keeps the other fields;
`set` replaces a value wholesale. A function that overwrites a stored model is `set`/`replace`, not
`update`.

**`is` vs `assert`.** If the caller decides what to do with a `false`, it is `is…`. If a `false`
means the operation cannot continue, it is `assert…` and it throws.

**`get` with I/O.** `get` may be async and may read — `getActiveModel` looks in the database — as
long as calling it changes nothing. Once a function writes, it is not a `get`, whatever it returns.

## 2.5 Booleans

- A function that returns `boolean` starts with `is` or `has` (or `can` / `should` when that reads
  better). `isCanonicalUuid`, not `canonicalUuid` or `checkUuid`.
- A boolean variable or field reads as a yes/no question: `isActive`, `hasWeights`,
  `isCrossOriginIsolated`.
- **Exception:** a field that mirrors an external format keeps that format's name — the model
  contract's `normalize` follows the repository's own configuration, and renaming it would break
  the correspondence a reader relies on.
- No negative names: `isEnabled`, not `isNotDisabled`; `isDeviceUnavailable` is acceptable only
  because unavailability is the case being tested for.

## 2.6 Variables and constants

**Local variables and parameters** are camelCase nouns: `manifest`, `storedFile`, `device`.
Collections are plural (`files`, `profiles`); a single item from one is singular (`file`).

**Module-level fixed values** are `SCREAMING_SNAKE_CASE`, exported or not:

```ts
export const POPUP_PATH = "popup.html";
const HEX_BY_BYTE = Array.from({ length: 256 }, …);
```

Conventions inside those names:

| Pattern                         | Means                                   | Examples                                            |
| ------------------------------- | --------------------------------------- | --------------------------------------------------- |
| `…_MS`, `…_BYTES`               | the unit, always as a suffix            | `INFERENCE_REQUEST_TIMEOUT_MS`, `UI_TIMEOUT_MS`     |
| `MINIMUM_…`, `MAXIMUM_…`        | a bound, spelled out                    | `MINIMUM_CHUNKS_PER_SECOND`                         |
| `…_BY_…`                        | a lookup table keyed by the second noun | `DEFAULT_PROFILE_BY_FAMILY`, `HEX_BY_BYTE`          |
| plural noun                     | a list                                  | `BUNDLED_MODEL_PROFILES`, `SUPPORTED_QUANTIZATIONS` |
| `…_TEST_ID`                     | a `data-testid` value                   | `MODEL_LIST_TEST_ID`                                |
| `…_PATH`, `…_ORIGIN`, `…_STORE` | what kind of identifier the string is   | `INFERENCE_WORKER_PATH`, `MODEL_STORE`              |

A number with no unit in its name is a bug waiting to happen: `TIMEOUT = 120` could be seconds or
milliseconds. Always add the unit.

**Not `SCREAMING_SNAKE_CASE`:** valibot schemas (see [2.7](#27-schemas)) and anything computed per
call. A value that is not fixed at module load is a variable, not a constant.

## 2.7 Schemas

valibot schemas are camelCase values — they are objects with behaviour, used like functions, not
data.

- A schema ends in `Schema` and is named for the shape it accepts: `modelManifestSchema`,
  `commitRevisionSchema`, `blockedRequestSchema`.
- A map of message schemas, keyed by message type, ends in `Schemas` and names its direction:
  `<module>RequestSchemas` / `<module>ResponseSchemas` (`modelRegistryRequestSchemas`,
  `workerResponseSchemas`).
- The type derived from a schema drops the suffix: `modelManifestSchema` → `ModelManifest`.

## 2.8 Types

Types and interfaces are PascalCase nouns. No `I`/`T` prefix (`ModelProfile`, not `IModelProfile`),
and no `Type` suffix except where listed below.

| Suffix / prefix                  | Use for                                                        | Examples                                         |
| -------------------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| `<Function>Options`              | The options object of one function, named after that function  | `InstallModelOptions`, `ActivateModelOptions`    |
| `<Component>Props`               | A component's props                                            | `ModelListProps`, `PanelProps`                   |
| `…Dependencies`                  | What a composition root takes from the browser                 | `BackgroundDependencies`                         |
| `…State`                         | State a reducer or surface holds                               | `OptionsState`, `InstallState`                   |
| `…Result`                        | The record a function returns                                  | `EmbedResult`, `ProbeResult`                     |
| `…Outcome`                       | A union of success and failure cases                           | `ConformanceOutcome`, `InferenceOutcome`         |
| `Stored…`                        | A record exactly as it is persisted                            | `StoredModel`, `StoredInferenceRun`              |
| `…Like`                          | A minimal structural stand-in for a platform type, for testing | `GpuLike`                                        |
| `…RequestType` / `…ResponseType` | The union of message-type strings of a protocol                | `ModelRegistryRequestType`, `WorkerResponseType` |

Generic parameters are `T` followed by what they stand for: `TSchemas`, `TType`. A lone `T` is
acceptable only in a one-line utility where nothing else could be meant.

## 2.9 Components and handlers

- **Components** are PascalCase nouns naming what they render: `ModelList`, `InstallProgress`,
  `Panel`. Not `RenderModels`, not `ModelListComponent`.
- **Composition roots** end in `App`: `PopupApp`, `OptionsApp`; the background's non-React root is
  created by `createBackgroundApp`.
- **Callback props** start with `on` and name the event: `onProgress`, `onMessage`.
- **The functions that implement them** start with `handle`, or with the specific verb when one
  exists (`requestBenchmark`, `requestInstall` in `OptionsApp`). `handle` is reserved for this; it
  never names a function that is not an event or message handler (`handleMessage` in
  `backgroundApp`).

## 2.10 Message types, events and test ids

These are strings, not identifiers, so they have their own conventions.

**RPC message types** are `<domain>.<action>`, the domain a noun, the action camelCase:

| Kind     | Form                        | Examples                                                |
| -------- | --------------------------- | ------------------------------------------------------- |
| Request  | imperative verb             | `model.install`, `model.list`, `benchmark.run`          |
| Response | past participle             | `model.installed`, `model.listed`, `benchmark.measured` |
| Progress | noun                        | `model.installProgress`                                 |
| Failure  | `<verb>Failed`, or `failed` | `model.installFailed`, `inference.failed`               |

**Local reducer events** (never sent over a port) are kebab-case, `<subject>-<past participle>`:
`install-requested`, `device-selected`. The dash keeps them visibly apart from RPC types, which a
reducer often handles alongside them.

**`data-testid` values** are kebab-case, scoped by the component: `model-list`, `model-list-empty`,
`install-failed`. Each lives in a `…_TEST_ID` constant that the e2e fixture reads.

## 2.11 Abbreviations and casing

**Acronyms are words.** In camelCase and PascalCase an acronym is capitalised like any other word:

```ts
(getExtensionUrl, buildHubUrl, parseRpcMessage, isCanonicalUuid, readRepositoryJson);
// not getExtensionURL, parseRPCMessage
```

In `SCREAMING_SNAKE_CASE` they are simply upper case (`RPC_VERSION`). Names that come from a
platform API keep its spelling (`blockedURI`, `browser.runtime.getURL`).

**Allowed short forms:** `id`, `url`, `uuid`, `json`, `rpc`, `gpu`, `ui`, `ms` (as a unit suffix),
`dtype` and `ort` (the runtime's own terms). Anything else is spelled out: `error` not `err`,
`options` not `opts`, `request` not `req`, `message` not `msg`, `index` not `idx`, `event` not `evt`.

## 2.12 Names in specs

Specs follow the same rules; helpers in a spec are functions too.

- **Test-data builders** start with `build`: `buildManifest()`, `buildModel({ isActive: true })`.
- **Test doubles** start with `create` and say what kind of double they are:
  `createFakePort()`, `createStubWorker()`, `createStubFetch(responses)`.
- A **constant fixture** shared by the tests in a file is a noun, like any value:
  `const manifest = buildManifest();`.
- `describe` names the unit (`"parseRpcMessage"`, `"bundled model profiles"`); `it` reads as a
  sentence about behaviour (`"refuses an envelope with an unknown version"`). The Testing section
  covers this in depth.

## 2.13 Known deviations

None found on 2026-10-09.
