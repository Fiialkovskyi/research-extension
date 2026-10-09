# 6. Storage

The extension keeps everything it stores in one IndexedDB database, opened through `idb`. This
section covers who may write it, how its shape is declared and how that shape changes.

- [6.1 One database, one writer](#61-one-database-one-writer)
- [6.2 Where the shape is declared](#62-where-the-shape-is-declared)
- [6.3 Records](#63-records)
- [6.4 Reading and writing](#64-reading-and-writing)
- [6.5 Transactions](#65-transactions)
- [6.6 Migrations](#66-migrations)
- [6.7 What is never stored](#67-what-is-never-stored)
- [6.8 Changing a stored shape: checklist](#68-changing-a-stored-shape-checklist)
- [6.9 Known deviations](#69-known-deviations)

## 6.1 One database, one writer

- **One database**, `research-graph` (`MODEL_DATABASE_NAME`), opened only by `openModelDatabase`.
- **Only the background writes.** A surface that needs something stored sends a message; the
  background writes and answers. This is not a preference: it rules out transaction races between
  contexts, and it keeps every surface a pure view of what the background reports.
- **The worker never touches storage**, not even to read. The background reads what the worker
  needs and sends it.
- **No other storage API.** No `browser.storage`, `localStorage`, `sessionStorage` or cookies. One
  place to look, one migration story, one thing to clear.

Functions that read or write take the opened database as a parameter
(`database: IDBPDatabase<ModelDatabaseSchema>`); they never open it themselves. The background app
opens it once, on first need, and passes it down. That is also what makes them testable against
`fake-indexeddb`.

## 6.2 Where the shape is declared

Everything about the database's shape lives in `src/shared/storage/`:

```
shared/storage/
├── index.ts                    # barrel
├── constants.ts                # name, version, store names, limits
├── types.ts                    # StoredModel, StoredModelFile, StoredInferenceRun, ModelDatabaseSchema …
├── openModelDatabase/
│   └── utils/
│       └── applyModelDatabaseUpgrade/   # UPGRADE_STEPS and the runner
├── readInferenceRuns/
└── recordInferenceRun/
```

- **Store names are constants** (`MODEL_STORE`, `MODEL_FILE_STORE`, `INFERENCE_RUN_STORE`), used
  everywhere a store is named — never a string literal at a call site.
- **`ModelDatabaseSchema`** (an `idb` `DBSchema`) declares each store's key, value and indexes. It is
  what types every `get`, `put` and index query; a store or index that is not in it does not
  compile.
- **Stored types are prefixed `Stored…`** ([2.8](./NAMING.md#28-types)) and are the shape exactly as
  persisted. What a surface renders is a separate type (`InstalledModelSummary`), built from the
  stored one — a stored record never travels to a surface as it is.

## 6.3 Records

- **Plain data only**: what structured clone keeps. Timestamps are epoch milliseconds (`number`),
  binary is `ArrayBuffer`, nothing is a class instance.
- **Every field is commented** with why it exists and any rule it carries ("Written only after its
  digest matched the manifest", "Deliberately not an index").
- **Keys are stable identities**, not counters: a model's `ref` is repository and pinned revision,
  a file's key is `[ref, path]`, a run's is a UUID. Two installs of different revisions coexist
  rather than collide.
- **Indexes exist for queries that run.** An index is added in a migration step together with the
  first code that queries it, never in anticipation. IndexedDB cannot index booleans; a flag is
  filtered in memory.
- **Logs are capped.** A store written on every operation has a maximum (`MAX_INFERENCE_RUNS`)
  enforced in the same transaction as the write.

## 6.4 Reading and writing

- **The function that owns a change does the write**: `installModel` puts the model,
  `downloadModelFiles` puts each verified file, `activateModel` records the outcome. They run in the
  background because only the background calls them.
- **Reads return `undefined` for absence** (see [3.7](./TYPESCRIPT_AND_FUNCTIONS.md#37-undefined-and-null)),
  and the caller decides whether that is an error — usually with a sentence that names the key:
  `No model is installed under "${ref}".`
- **A write that depends on a check happens after the check.** Model files are stored only once
  their digest has matched; a model is marked usable only once conformance has passed. Storing first
  and checking later leaves a window in which unchecked data is visible.
- **A failed multi-step operation cleans up what it wrote** (`removeStoredFiles` after a failed
  download), so a half-finished install never looks like a finished one.

## 6.5 Transactions

- **Writes that must agree share one transaction.** If two writes describe one fact — "this model is
  active and its siblings are not" — they go in one `readwrite` transaction over the stores
  involved, so a failure leaves neither.
- **No unrelated `await` inside a transaction.** IndexedDB commits a transaction as soon as it has
  no pending requests; awaiting a fetch or a timer in the middle ends it. Fetch first, then open the
  transaction and write.
- **Await `transaction.done`** at the end of an explicit transaction, so a failed commit reaches the
  caller.
- **Single-store, single-write** operations may use the shortcut (`database.put(store, value)`),
  which is its own transaction.

## 6.6 Migrations

`MODEL_DATABASE_VERSION` is the schema version. A profile below it is upgraded on open by running
each step in `UPGRADE_STEPS` from its version up to the current one:

```ts
export const UPGRADE_STEPS: Readonly<Record<number, UpgradeStep>> = {
  1: (database) => {
    /* create the stores and their first indexes */
  },
  2: (_database, transaction) => {
    transaction.objectStore(INFERENCE_RUN_STORE).createIndex("startedAt", "startedAt");
  },
};
```

- **Forward-only.** A released step is never edited. A profile that has already run step 1 will not
  run it again, so changing it would leave two profiles at the same version with different schemas.
  A mistake in a released step is fixed by a new step.
- **Every schema change is a step**: a new store, a new or removed index, and a change in a record's
  shape. Raising the version adds exactly one step, keyed by the version it upgrades **to**.
- **No gaps.** The runner refuses to upgrade past a missing step rather than skipping it.
- **One transaction.** All steps run inside the version-change transaction, so a step that throws
  aborts the whole upgrade and the profile stays at its old version — safe to retry.
- **A shape change rewrites existing records** in its step (open a cursor on the store, transform,
  `update`), so code that reads after the upgrade sees only current-shape records and needs no
  "old format" branch.
- **Steps are tested** through `applyModelDatabaseUpgrade` against `fake-indexeddb`: a fresh profile
  reaches the current version, and a profile at each earlier version reaches it too.

## 6.7 What is never stored

- **Content a user was reading.** The inference run log has no field for text: it records counts,
  timings and the device. That is enforced by the record's shape, not by care at the call site —
  there is nowhere to put content.
- **Credentials or identities.** Model downloads carry none, and nothing that could identify a user
  is written.
- **Anything unverified.** A model file is written only after its digest matched the manifest.
- **Derived values** that can be recomputed from what is stored.

## 6.8 Changing a stored shape: checklist

1. Change the `Stored…` type and `ModelDatabaseSchema` in `shared/storage`.
2. Raise `MODEL_DATABASE_VERSION` by one.
3. Add the step for the new version to `UPGRADE_STEPS`: create stores or indexes, and rewrite
   existing records to the new shape.
4. Add specs for the step: from a fresh profile and from the previous version, with records present.
5. Update the code that writes the record, and the summary types built from it.
6. If a field was renamed, search for the old name in specs and fixtures too.

## 6.9 Known deviations

Found on 2026-10-09. Fix each when the file is next touched; delete the line when you do.

- `src/shared/storage/constants.ts` holds the stored types and the `DBSchema` → `types.ts` (see
  [1.12](./PROJECT_STRUCTURE.md#112-known-deviations)); `MAX_INFERENCE_RUNS` →
  `MAXIMUM_INFERENCE_RUNS` (see [2.13](./NAMING.md#213-known-deviations)).
- `StoredModel.active` → `isActive` needs a migration step that rewrites existing records (see
  [4.10](./REACT_AND_UI.md#410-known-deviations)).
