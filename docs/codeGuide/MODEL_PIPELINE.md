# 7. Model pipeline

The one path that crosses most of the codebase: how a model goes from a line in a profile to a
vector a feature can use. `AGENTS.md` gives the seven steps in brief; this section gives the rules
each step keeps, and what to do when adding a model or a model family.

> **Switched off for now.** The in-extension backend this section describes is disabled by
> `IS_IN_BROWSER_BACKEND_ENABLED` (`shared/config/modelBackends`): the local Ollama server is the
> only backend offered, set up from the setup page. The code is kept and the rules below still hold
> for it; turning the flag on also restores the model hosts in the manifest.

- [7.1 The path](#71-the-path)
- [7.2 The two invariants](#72-the-two-invariants)
- [7.3 Profiles](#73-profiles)
- [7.4 Pinning and describing](#74-pinning-and-describing)
- [7.5 Fetching and verifying](#75-fetching-and-verifying)
- [7.6 Loading](#76-loading)
- [7.7 Conformance and activation](#77-conformance-and-activation)
- [7.8 Using a model from a feature](#78-using-a-model-from-a-feature)
- [7.9 Adding a model](#79-adding-a-model)
- [7.10 Adding a model family](#710-adding-a-model-family)
- [7.11 Known deviations](#711-known-deviations)

## 7.1 The path

| #   | Step                           | Owner                                                             | Leaves behind                                                               |
| --- | ------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | A profile says which model     | `shared/config/modelProfiles`                                     | repository, pinned commit, files, contract                                  |
| 2   | The reference is pinned        | `modelRegistry/resolveModelRevision`                              | a 40-character commit                                                       |
| 3   | The model is described         | `modelRegistry/buildModelManifest`                                | a manifest: sizes, digests, limits, contract                                |
| 4   | Files are fetched and verified | `modelInstall/downloadModelFiles`, orchestrated by `installModel` | verified files in storage; model recorded **inactive, conformance pending** |
| 5   | The model is loaded            | `inference/loadModelIntoWorker` → `createExtOrtProvider`          | a session in the worker                                                     |
| 6   | The model is judged            | `modelConformance/runEmbeddingConformance`                        | probe results and a verdict                                                 |
| 7   | Only then may it be used       | `modelRegistry/activateModel`, read through `getActiveModel`      | an active model, or a recorded reason why not                               |

Each step's owner is the only place that step happens. A second implementation of any of them —
a convenience fetch, a shortcut activation — is a bug even if it works.

## 7.2 The two invariants

**Nothing reaches the runtime unverified.**

- Step 4 checks every file's digest **before** storing it.
- Step 5 replaces the runtime's cache with one that serves exactly the stored files, and switches
  remote loading **off** (`env.allowRemoteModels = false`, `env.useBrowserCache = false`), so a file
  the cache does not hold fails the load instead of being fetched.
- Any change that lets the runtime fetch a file itself — enabling remote models, falling back to the
  browser cache, passing a hub URL to the runtime — undoes both steps at once. Such a change needs an
  OpenSpec change and a security review, not a code review.

**A model is unusable until it has been judged.**

- Step 4 records a model **inactive** with conformance **pending**, on purpose.
- Only `activateModel` sets `active: true`, and only when conformance passed in this runtime, on this
  device.
- `getActiveModel` checks both `active` and `conformance === "passed"`, so even a record written by
  an older build or a bug cannot put an unjudged model behind a feature.

## 7.3 Profiles

A profile (`ModelProfile`) records **only what a repository does not publish about itself**:

- `repository` and `revision` — a 40-character commit, never a branch;
- `quantization` and the exact `files` to install — listed, not discovered;
- `license`, with a comment when the hub does not publish one;
- `contract` — the behaviour the model promises and conformance will check: pooling, normalization,
  similarity metric, role prefixes for an encoder.

What the repository does publish — dimensionality, token limits, file sizes, digests — is **read
from it** in step 3, never copied into the profile, so a profile cannot disagree with the model it
names.

Each profile carries a doc comment saying why it is bundled: what it costs, and what part of the
contract it exercises that the others do not (`BGE_SMALL_EN_V1_5` exists for its asymmetric
prefixes).

Profiles have guard specs ([1.7](./PROJECT_STRUCTURE.md#17-constantsts-schemasts-and-typests)):
every revision is a commit, every repository is `owner/name`, every profile declares a license.

## 7.4 Pinning and describing

- **A reference is resolved exactly once** (`resolveModelRevision`) and the commit is what gets
  recorded. Nothing re-resolves it: a model must keep meaning the same weights for as long as it is
  installed.
- **A reference that is already a commit is returned untouched**, without a request, so an install
  of a pinned profile needs no extra round trip.
- **Gated repositories are refused**, with a reason: access needs an account, and model downloads
  carry no credentials.
- **The manifest is validated against `modelManifestSchema`** before it is used. It is the document
  every later step trusts, so it is the one that must not be malformed.
- **Hub responses are `unknown`** until parsed by their schema (`parseModelTree`,
  `readModelLimits`).

## 7.5 Fetching and verifying

- **One file at a time**, in order — the one place `await` in a loop is allowed, and it is declared
  in `.oxlintrc.json`.
- **No credentials**: every request is `credentials: "omit"`.
- **Only declared hosts.** The content security policy's `connect-src` lists the hub origins
  (`MODEL_HOST_ORIGINS`); a request elsewhere is refused by the browser and reported by
  `collectPolicyViolations`.
- **Digest before storage**: `assertFileDigest` throws on a mismatch, and only then is the file
  written.
- **All or nothing**: any failure removes every file the attempt wrote (`removeStoredFiles`).
- **Progress is reported** through `onProgress` — bytes and the file in flight — and streamed to the
  surface as `model.installProgress`.

## 7.6 Loading

- The **background** reads the verified files from storage and sends them to the worker in
  `model.load`; the worker never reads storage or the network.
- `createExtOrtProvider` is imported **by path, dynamically, in the worker only** — it pulls in the
  model runtime (see [1.5](./PROJECT_STRUCTURE.md#15-barrels)).
- Runtime binaries come from the package (`public/ort/`, copied by `scripts/syncOnnxRuntime.ts`),
  never from a CDN.
- **The compute device is chosen, not defaulted by the runtime.** It travels with the request, and a
  change of device, or a failed start, gets a fresh worker (see
  [5.7](./MESSAGING.md#57-the-background)).
- The provider's own logic — dtype choice, pooling, prefixing, splitting a batch — lives in its
  `utils/`, where it is tested without WebAssembly. The provider itself is configuration and glue.

## 7.7 Conformance and activation

- **Conformance runs on every activation**, not once at install: the result depends on the runtime
  and the device as much as on the weights.
- **The suite checks the contract the profile declared**: dimensions, norm (if normalized),
  determinism, and that paraphrases rank above unrelated text. Thresholds are named constants with a
  comment on why that value (`MINIMUM_ORDERED_PROBES`, `MINIMUM_DETERMINISM_SIMILARITY`,
  `NORM_TOLERANCE`).
- **Every probe's result is kept and shown**, not only the verdict: "4 of 20 pairs ordered correctly"
  is actionable; "failed" is not.
- **A failure is recorded**, with its reason, rather than merely refused.
- **At most one active model per family.** Activating one deactivates the others in the same
  family.
- **A family without a suite cannot be activated** — the background answers with the reason.

## 7.8 Using a model from a feature

- **By family, never by repository**: `getActiveModel(database, "embedding")`. A feature that names a
  repository cannot survive the model being swapped.
- **Handle "none"**: `getActiveModel` returns `undefined` when no model of that family is usable,
  and the feature says so to the user rather than failing.
- **Embed with the right role** (`query` or `document`), so the profile's prefixes are applied; never
  prepend a prefix by hand.
- **Record the run** (`recordInferenceRun`) — counts, timings and device, never content.

## 7.9 Adding a model

1. Add a profile to `shared/config/modelProfiles/constants.ts`: pinned commit, exact files,
   quantization, license, contract. Write the doc comment: why this model, what it costs, what it
   exercises.
2. Add it to `BUNDLED_MODEL_PROFILES`.
3. If its files live on a host not yet in `MODEL_HOST_ORIGINS`, that is a network-policy change —
   see the Security section; it needs an OpenSpec change.
4. Run the network e2e spec (`modelInstallNetwork.e2e.ts`) to install it and pass conformance for
   real, and record the numbers.

## 7.10 Adding a model family

1. Extend `MODEL_FAMILIES` and the contract union (`modelContractSchema`, the profile contract
   types).
2. Write the family's conformance suite in `features/modelConformance` — without it, the family
   cannot be activated, by design.
3. Extend the worker protocol and the provider for the family's operation.
4. Give features a way to reach it through `getActiveModel` by the new family name.
5. Plan it as an OpenSpec change first: a new family is a new capability.

## 7.11 Known deviations

None found on 2026-10-09.
