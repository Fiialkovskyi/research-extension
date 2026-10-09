# Local inference research notes

Everything established while building the `spike-huggingface-inference` change: can a Hugging Face
model be downloaded and executed **inside a Firefox extension** without breaking the no-remote-code
and no-egress guarantees?

Each entry says how it was established. **Verified** means measured or read from a live response in
this repository. **Documented** means taken from a primary source. **Hypothesis** means not yet
confirmed here — and the spike is not finished until those are resolved.

Last updated 2026-10-09, against Firefox 157.0 on an Apple M4 Pro.

Ephemeral measurements belong in `openspec/changes/spike-huggingface-inference/design.md` under
Findings. This file holds the durable facts, including the ones that cost real time to learn.

---

## 1. The platform decides more than the library does

### WebAssembly threads are not available to us at all

**Documented, and now verified in our own add-on.** Firefox extension pages cannot become cross-origin isolated. Every extension shares
one process, and Firefox supports no manifest COOP/COEP opt-in of the kind Chrome offers
([bug 1673477](https://bugzilla.mozilla.org/show_bug.cgi?id=1673477),
[bug 1674383](https://bugzilla.mozilla.org/show_bug.cgi?id=1674383) — both open).

Consequences, in order of how much they matter:

1. `self.crossOriginIsolated` is false, so `SharedArrayBuffer` is absent.
2. ONNX Runtime Web therefore falls back to a single thread — **silently**
   ([ORT issue 19148](https://github.com/microsoft/onnxruntime/issues/19148)).
3. Single-threaded WebAssembly is the **floor of our performance envelope**, not a degraded mode.

The target spec's spike M0-2 asks to confirm "WASM threads availability". That question is void: the
answer is no, by platform design, and nothing in our control changes it. The thread count is now set
to one explicitly, so the fallback is a recorded decision rather than an invisible one.

**Measured in the extension, not inferred.** `e2e/specs/optionsSurface.e2e.ts` loads the options
page in Firefox 157, waits for the surface to report what the runtime can do, and asserts it says
`no cross-origin isolation` and `single-threaded`. It passes. A future Firefox that changed this
would fail that test instead of silently making the add-on faster, which is the point of asserting a
constraint rather than documenting it.

### WebGPU exists on this machine but not on our declared minimum

**Documented.** WebGPU is on by default on Apple Silicon from Firefox 145/147
([MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Experimental_features),
[gpuweb status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)). Intel Macs and Linux
are not enabled in stable releases.

The manifest declares `strict_min_version: "140.0"`, and the target spec also budgets for a Linux
machine with no usable WebGPU. So **WebGPU is an accelerator, and every NFR budget has to be judged
against the WebAssembly number.** Measuring only on this M4 Pro would flatter the project into a
false conclusion.

Practical consequence for benchmarking: force the software path with the `dom.webgpu.enabled`
preference rather than trusting whichever the runtime picks.

---

## 2. The runtime will not start unless its binaries ship with us

**Verified.** Transformers.js 4.3.1 resolves the ONNX Runtime WebAssembly artefacts from a public CDN
by default. From `node_modules/@huggingface/transformers/src/backends/onnx.js`:

```js
const wasmPathPrefix = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNX_ENV.versions.web}/dist/`;
let wasmPathSuffix = ".asyncify"; // Default to asyncify WASM build
```

Two things make this fatal rather than merely non-compliant:

- Our `connect-src` blocks the request outright.
- `ONNX_ENV.versions.web` is `1.31.0-dev.20260914-8d85527a0` — a pre-release that Transformers.js
  pins and that may not be published on that CDN at all.

So packaging the binaries is what makes inference **work**, not just what satisfies REQ-RT-006.

### Which variants, and why two

**Verified** sizes in `onnxruntime-web@1.31.0-dev.20260914-8d85527a0`:

| File                                   | Size     | Role                                                                       |
| -------------------------------------- | -------- | -------------------------------------------------------------------------- |
| `ort-wasm-simd-threaded.wasm`          | 14.26 MB | plain build                                                                |
| `ort-wasm-simd-threaded.asyncify.wasm` | 26.86 MB | asyncify; what the library picks by default and what the WebGPU path needs |
| `ort-wasm-simd-threaded.jsep.wasm`     | 28.35 MB | JSEP build; ORT's own internal default                                     |
| `ort-wasm-simd-threaded.jspi.wasm`     | 16.81 MB | JSPI variant                                                               |

**The variants are not interchangeable, and the naming does not say so.** The plain build carries no
WebGPU support at all; requesting that device against it fails with

```
no available backend found. ERR: [webgpu] TypeError: O().webgpuInit is not a function
```

which names a missing function rather than a missing backend. **JSEP is the WebGPU-capable build.**
Transformers.js's own default suffix is `.asyncify`, which is also not WebGPU-capable, so following
that default and then asking for WebGPU produces the same error.

We ship the plain build for the CPU path and the JSEP build for WebGPU, plus their `.mjs` loaders:
**42.7 MB in the package.** Two because they are not interchangeable (above), and the plain one for
CPU because it is half the size and carries none of the accelerator plumbing.

`scripts/syncOnnxRuntime.ts` copies them out of `node_modules` into a gitignored `public/ort/`, so
41 MB of generated binaries never enter git and a dependency bump cannot leave a stale binary behind.
It also **prunes** files from variants no longer shipped: without that, changing a variant leaves
tens of megabytes of dead weight in the package indefinitely — which is what happened when the
WebGPU variant changed from asyncify to JSEP.

Relevant to the target spec's §15 risk "AMO review of WASM and large bundles". No NFR governs package
size today, and the number that matters there is the **packaged** one: 41 MB on disk compresses to
**10.1 MB** in the submitted zip, because WebAssembly compresses well. Worth knowing before treating
the on-disk figure as a submission problem.

---

### How verified files reach the runtime

**Verified** by reading `src/utils/hub.js` and `src/utils/cache.js` of
`@huggingface/transformers@4.3.1`.

The library resolves each file it needs to a hub URL and consults a cache **before** it consults any
of its own loading switches. Two settings therefore do all the work:

```ts
env.useCustomCache = true;
env.customCache = ourCache; // keyed by https://huggingface.co/<repo>/resolve/<rev>/<file>
env.useBrowserCache = false;
env.allowLocalModels = false;
env.allowRemoteModels = false; // a cache miss is a failed load, never an unchecked download
```

The cache key the library proposes is exactly the URL our installer already builds, so a cache backed
by our verified files hands them over and the network is never reached. On a miss with remote loading
off, `loadResourceFile` throws `ModelFileNotFoundError` for a required file and returns `null` for an
optional one — which is the behaviour we want in both cases.

The custom cache must implement `match` and `put` of the Web Cache API. Ours refuses writes:
anything the library wanted to store would be bytes that never passed digest verification, and
keeping those beside verified files would make the store's guarantee meaningless.

**One setting cannot be what it looks like.** The configuration above fails: Transformers.js refuses
outright when _both_ local and remote loading are off, throwing

```
Invalid configuration detected: both local and remote models are disabled.
```

before it consults any cache (`src/utils/hub.js`, the guard around line 516). So one of them has to
be true, and the harmless one is **local**:

```ts
env.allowRemoteModels = false; // the setting that matters
env.allowLocalModels = true; // forced on by the guard above
env.localModelPath = "/models/"; // a path the package does not contain
```

A cache miss then resolves against `localModelPath` inside the extension's own origin, finds
nothing, and still ends as a failed load because remote loading is off. Nothing leaves the package
either way — but the code reads as though it permits something it does not, which is exactly why the
reason is written next to it.

### The runtime asks for `main` even when handed a pinned commit

**Verified, and it matters beyond the cache.** `pipeline(task, model, { revision })` accepts a
revision, and the browser bundle still requested

```
https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/config.json
```

while the cache held the same file under `resolve/751bff37…/config.json`. Every lookup missed, and
the error named only the local path it checked last — `/models/…/config.json` — which says nothing
about the key it actually wanted.

Two conclusions:

- **Pinning is enforced by us supplying the files, not by the library honouring the revision.** With
  remote loading enabled, the library would fetch `main`. REQ-MOD-002 holds here only because
  `allowRemoteModels` is off and the only bytes available are the ones already verified against the
  manifest.
- **The cache matches on repository and file path, ignoring the revision segment.** That is not
  laxity: the cache is built per load, holds one model's already-verified files and nothing else, so
  there is no other revision it could serve by mistake. Keying on the commit would simply never
  match.

The diagnosis cost three browser runs because the library's miss message points at the wrong place.
The cache now records what it was asked for alongside what it holds, and the provider puts both in
the error — so the next mismatch of this kind is a one-run diagnosis.

### The runtime's WASM cache needs `blob:` in `script-src`, so it is switched off

**Verified.** With `wasmPaths` supplied as an object, Transformers.js pre-loads the binary and then
**replaces the loader path with a `blob:` URL that it dynamically imports**
(`src/backends/onnx.js`, the `shouldUseWasmCache` branch). The package's policy refuses that, and
should: permitting `blob:` in `script-src` would let any code in this origin assemble a script and
run it.

The symptom is unhelpfully far from the cause:

```
no available backend found. ERR: [wasm] TypeError:
error loading dynamically imported module: blob:moz-extension://…/…
```

The fix is one documented setting:

```ts
env.useWasmCache = false;
```

The loader is then imported straight from the package (`'self'`), the binary is fetched from the
packaged path, and `wasmPaths` stays an object — so the per-device choice between build variants
survives.

### Backend initialisation is memoised per worker, so a device change needs a new worker

**Verified the hard way.** After one failed attempt to start on WebGPU, every subsequent load in
that worker failed identically — including loads explicitly requesting the software path, and
including after the surface was reloaded. The runtime memoises its backend initialisation at module
scope (`wasmLoadPromise`: _"If already loading or loaded, return the existing promise"_), so the
first attempt in a realm is the one it keeps, successful or not.

Two consequences for the background:

- **A compute-path change requires a fresh worker.** The background now tracks which device the live
  worker initialised for and replaces it when the request differs.
- **A failed load discards the worker.** Otherwise the next attempt asks a poisoned runtime, fails
  the same way, and reads as a defect in the model rather than in the runtime's state.

This cost several browser runs to find, because the symptom — the same WebGPU error on a request
that named the software path — looks nothing like its cause.

### Batch width changes a vector by about half a percent

**Verified on two models.** Embedding a text inside a batch of twenty and then alone gives vectors
with a cosine similarity of **0.9945** (MiniLM-L6-v2) and **0.99455** (bge-small-en-v1.5). The
agreement between two unrelated models says this is the runtime, not the weights: batch width sets
the padded sequence length, and under 8-bit quantization that moves the result.

Two consequences, and the first is a correction to our own test:

- **A determinism probe must compare like with like.** The first version compared a vector taken
  from a batch of twenty against one taken alone and reported 0.9945 as non-determinism. It was
  measuring batch sensitivity. Both embeddings now come from a batch of the same shape.
- **Vectors computed in differently-sized batches are not interchangeable at full precision.** The
  drift is ~0.005, comfortably below the thresholds the target spec uses — 0.55 for semantic edges
  (§5), 0.85 for entity resolution (§8) — so it is tolerable. It is worth recording anyway, because
  a future check that assumes stored and freshly-computed vectors agree to four decimal places would
  fail for a reason nobody would guess.

### Session creation is deferred to the first inference

**Verified, and it invalidated a measurement.** A loaded model reported `loadDurationMs` of **0.07 s**
— impossible for a 23 MB model — because the runtime builds its inference session on first use, not
on load. The first batch therefore pays for start-up, and a benchmark that times it reports start-up
as throughput.

The first software-path figure, **4.3 chunks/s over 40 chunks in 9.40 s**, was measured that way and
is therefore pessimistic. The benchmark now runs a small batch and discards it before the clock
starts.

**This pairing is what makes verification mean anything.** Without it the library would fetch its own
files and the whole install pipeline would be decoration.

---

## 3. Hugging Face hub mechanics

### The host list is published, and it is deeper than the docs table

**Verified.** `https://huggingface.co/.well-known/meta.json` returns the live set. It includes
four-label names such as `us-east1.us.gcp.cdn.hf.co`, which the documentation's own warning says a
single-label proxy wildcard will not cover
([HF docs](https://huggingface.co/docs/hub/main/en/models-downloading)).

Groups returned: `hubDomains` (`huggingface.co`, `hf.co`, `huggingface.com`, `huggingface.cn`),
`lfsDomains` (`cdn-lfs.hf.co`, `cdn-lfs-us-1.hf.co`, `cdn-lfs-eu-1.hf.co`,
`transfer.xethub.hf.co`, `transfer.xethub-eu.hf.co`), and `cdnDomains` (twelve entries including
`aws.cdn.hf.co`, `us.aws.cdn.hf.co`, `us-east1.us.gcp.cdn.hf.co`).

**Verified by a real install.** Two profiles were downloaded end to end in Firefox 157 with the
policy below, and the add-on's own violation log reported **nothing blocked** — so one wildcard does
cover every storage and CDN host a download redirects to:

```
script-src 'self' 'wasm-unsafe-eval'; object-src 'none';
connect-src 'self' https://huggingface.co https://*.hf.co
```

The reasoning that predicted it: CSP host wildcards have different semantics from proxy
wildcards: the CSP Level 3 grammar describes `*.example.com` as matching "any resource on the host's
subdomains, and any of its subdomains' subdomains, and so on"
([CSP3 §2.3.1](https://w3c.github.io/webappsec-csp/)). That is why one `https://*.hf.co` entry suffices where a proxy
would need the explicit list.

How it was confirmed: the background context listens for `securitypolicyviolation` events — they are
reported where the request was attempted, so a listener on a surface would never see what the
background was refused — deduplicates them by origin and directive, and the options page shows the
result. An empty list after a successful install is the evidence; a non-empty one would have named
the host to add.

Note `*.hf.co` does **not** match bare `hf.co`. We never request it, so it is deliberately absent.

### Small files never leave the hub origin

**Verified.** Requesting a small non-LFS file redirects _within_ `huggingface.co`:

```
GET /Xenova/all-MiniLM-L6-v2/resolve/751bff37.../config.json
→ 307 /api/resolve-cache/models/Xenova/all-MiniLM-L6-v2/751bff37.../config.json?...&etag="72147e4f..."
→ 200
```

So only large-file-storage objects — the weights — are expected to reach a CDN host. The `ETag`
carries the same git object hash the file listing reports, which means the digest can be checked
against the response headers as well as against the manifest.

### Digests: SHA-256 only for the weights

**Verified** from `/api/models/<repo>/tree/<revision>?recursive=1`:

- Files in large-file storage carry `lfs.oid`, a **SHA-256**. In practice: the `.onnx` weights.
- Everything else carries only `oid`, the **git object hash (SHA-1)**. In practice: `config.json`,
  `tokenizer.json`, `tokenizer_config.json`, `vocab.txt`, `special_tokens_map.json`.

**This makes REQ-MOD-003 — "every file verified against the manifest SHA-256" — literally
unachievable from hub metadata.** The requirement in the change's spec delta was reworded rather than
left promising what it cannot deliver. What we do instead: verify with the strongest digest each file
actually has, and record the algorithm next to the value so a manifest never claims a SHA-256 it
never had.

The alternative — computing a SHA-256 of small files on first download and pinning it — reads
stronger and is weaker: it trusts whatever arrived first, whereas the git object hash is published by
the hub and tied to the commit the install is pinned to.

#### The git object framing, confirmed before relying on it

**Verified.** `sha1("blob " + byteLength + "\0" + contents)` reproduces the hub's `oid` exactly:

|                 |                                                           |
| --------------- | --------------------------------------------------------- |
| File            | `config.json` of `Xenova/all-MiniLM-L6-v2` at `751bff37…` |
| Size            | 650 bytes (matches the listing)                           |
| Computed        | `72147e4ff4426ebedbfa2146c4a0999def51a313`                |
| Published `oid` | `72147e4ff4426ebedbfa2146c4a0999def51a313`                |

Worth the one check: getting the framing wrong would have made verification reject every small file.

### Endpoints we depend on

| Purpose             | Endpoint                                    | What we read                             |
| ------------------- | ------------------------------------------- | ---------------------------------------- |
| Pin a reference     | `/api/models/<repo>/revision/<ref>`         | `sha`, and `gated`                       |
| Describe a revision | `/api/models/<repo>/tree/<rev>?recursive=1` | `type`, `path`, `size`, `oid`, `lfs.oid` |
| Fetch a file        | `/<repo>/resolve/<rev>/<path>`              | the bytes                                |
| Host allowlist      | `/.well-known/meta.json`                    | live storage and CDN hostnames           |

`/api/models/<repo>` also reports `gated` and `private`. **Verified:** both installed profiles are
`gated: false, private: false`. A gated repository cannot be installed at all, because access
requires accepting terms with an account and model downloads deliberately carry no credentials.

---

## 4. Models: real numbers

All sizes **verified** from the tree endpoint. Quantized weights plus tokenizer, which is what the
footprint budget (NFR-005, ≤ 150 MB) actually governs.

| Model                                       | Pinned revision                            | Published shape                                                                | q8 weights                                      | Verdict                                                                        |
| ------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `Xenova/all-MiniLM-L6-v2`                   | `751bff37182d3f1213fa05d7196b954e230abad9` | `hidden_size` 384, `model_max_length` 512                                      | 22.97 MB (tokenizer 0.71 MB)                    | **Default profile.** Smallest thing that does the job                          |
| `Xenova/bge-small-en-v1.5`                  | `ea104dacec62c0de699686887e3f920caeb4f3e3` | BERT-small class                                                               | 34.01 MB (tokenizer 0.71 MB)                    | **Second profile.** Declares an _asymmetric_ prefix pair                       |
| `onnx-community/embeddinggemma-300m-ONNX`   | `5090578d9565bb06545b4552f76e6bc2c93e4a66` | `hidden_size` 768, `model_max_length` 2048                                     | 308.89 MB of external data + 20.32 MB tokenizer | **Rejected.** Fails NFR-005 in every quantization (q4f16 is still 175.41 MB)   |
| `onnx-community/Qwen3-0.6B-ONNX`            | `1e0a4a196ecabdf9a879664110574563d3f372d3` | `hidden_size` 1024, `max_position_embeddings` 40960, `model_max_length` 131072 | q4f16 569.79 MB, q8 617.69 MB, q4 919.10 MB     | Phase B candidate, gated behind the throughput gate                            |
| `onnx-community/SmolLM2-360M-Instruct-ONNX` | `fe7c7db4c8921c9e3fa1c65cfd296fb3b1b1a8f9` | —                                                                              | q4f16 272.35 MB                                 | Lighter phase-B fallback; does **not** declare `library_name: transformers.js` |

The second profile was substituted deliberately. The plan named EmbeddingGemma; at 308 MB of external
weight data it cannot meet the footprint budget in any form. `bge-small-en-v1.5` serves the same
purpose better at 34 MB, because it instructs the **query side only** — which is the part of the
embedding contract the default profile, having no prefixes at all, cannot exercise.

### External data is a real installation detail

**Verified.** `config.json` of both EmbeddingGemma and Qwen3 carries
`transformers.js_config.use_external_data_format`, meaning the weights live in a sidecar
`.onnx_data` file that the installer must fetch alongside the `.onnx` graph. Related: ORT has a
reported hang with external data **and** multithreading
([issue 26858](https://github.com/microsoft/onnxruntime/issues/26858)) — we are single-threaded, so
this should not bite, but it is worth knowing before blaming a model.

### What a repository publishes, and what it does not

**Verified** across all five models above.

Published, so **read** rather than declared:

- `config.json` → `hidden_size` (an embedding model's dimensionality),
  `max_position_embeddings`.
- `tokenizer_config.json` → `model_max_length`.

Not published anywhere machine-readable, so **declared by a bundled profile** and checked afterwards
by the conformance suite: pooling strategy, whether output is normalized, the similarity metric, and
the role prefixes. This is exactly the split REQ-MOD-004 describes.

Two traps in the published values:

- **Take the smallest bound.** Qwen3 reports `model_max_length` 131072 against
  `max_position_embeddings` 40960. A tokenizer willing to encode more than the model can attend to is
  not a licence to send that much.
- **Sentinels are not limits.** Some repositories record values around `1e30` in `model_max_length`.
  That is the absence of a limit, and treating it as a declared contract value would let a model
  claim a context it does not have. Implausible values are reported as absent.

---

## 5. Bundling: three ways to accidentally ship 72 MB

Each of these was found by reading the build output rather than by reasoning, and each would have
shipped silently.

### A barrel re-export dragged the runtime into the background

**Verified.** Exporting the provider from `features/inference/index.ts` meant the background — which
needs only the protocol types — imported the whole model runtime transitively:

|                                                           | `background.js` |
| --------------------------------------------------------- | --------------- |
| Provider exported from the feature barrel                 | **72.20 MB**    |
| Provider kept out of it, imported by path from the worker | **24.48 kB**    |

A feature's barrel being its only public surface is a good rule that, applied here, costs three
orders of magnitude. The provider is now absent from the barrel and the worker imports it by path,
so the weight lands in the one context that runs models. The barrel says so, in a comment, because
the next person to "tidy up" the exports would otherwise undo it.

### The runtime's default export inlines its own WebAssembly

**Verified, and this one mattered twice.** `onnxruntime-web`'s default `import` condition resolves to
a _bundle_ build that embeds the binary as a base64 data URI. The worker bundle held **two of them,
about 35.8 MB each**.

Selecting the external-wasm condition in the Vite config fixes it:

```ts
resolve: {
  conditions: ["onnxruntime-web-use-extern-wasm", "module", "browser", "development|production"];
}
```

(Listed with the defaults because Vite replaces this array rather than extending it.)

|                         | `inferenceWorker.js` | whole package |
| ----------------------- | -------------------- | ------------- |
| Default condition       | 72.19 MB             | 113.65 MB     |
| External-wasm condition | **511.34 kB**        | **41.97 MB**  |

The size is the lesser half. The important part is that **before this change `wasmPaths` was
unused**: the inlined copy won, so the binaries we carefully packaged were dead weight and the
"ships all of its own code" story described something that was not happening. A 72 MB saving is nice;
knowing which copy actually runs is the point.

### An unlisted script is built as an IIFE, so it cannot code-split

**Verified.** WXT emits an unlisted script in IIFE format. Two consequences:

- A dynamic `import()` does not defer anything — it is inlined. Loading the runtime only on demand,
  so that a capability probe stays cheap, does not work this way. The import is kept anyway because
  it expresses the intent and costs nothing; the deferral would need a different entrypoint type.
- The build warns `[EMPTY_IMPORT_META] import.meta may not be a valid syntax with the iife output
  format`. **Inert here:** the built worker contains zero `import.meta` occurrences, and the runtime
  binaries are addressed through explicit `wasmPaths` rather than relative to a module URL. Worth
  re-checking after any dependency bump, because the failure mode would be a runtime that silently
  looks for its binary in the wrong place.

---

## 6. Toolchain traps, each cost real time

### The project tsconfig was silently dropping WXT's generated types

**Verified, and it was a pre-existing bug.** `extends` inherits `compilerOptions` only — not
`include`. The root `tsconfig.json` declared its own `include`, so `.wxt/types/*.d.ts` was never in
the program. Nothing had needed those declarations until a typed `runtime.getURL` did. Fixed by
including `.wxt/wxt.d.ts`, which references all of them.

Worth remembering as a class of problem: a config that _looks_ inherited may only be half inherited.

### WXT specifics

- `options_ui` and `background` are **generated from entrypoints**, not declared by hand. Declaring
  them while no entrypoint exists emits manifest keys pointing at missing files.
- Firefox MV3 gets a real event page: the built manifest is
  `background: { "scripts": ["background.js"] }` with no `service_worker` key. **Verified.**
- `publicDir` defaults to `<srcDir>/public`. Set to the root `public/` so generated binaries stay out
  of the source tree.
- The worker is an **unlisted script** entrypoint, built to `inferenceWorker.js`. With
  `imports: false`, the helpers come from `wxt/utils/define-background`,
  `wxt/utils/define-unlisted-script` and `wxt/browser`.
- `defineUnlistedScript` is a trivial wrapper (`{ main }`), so it is safe in a worker realm.

### jsdom and test-environment quirks

- **`SubtleCrypto` rejects a cross-realm `ArrayBuffer`.** `crypto.subtle.digest("SHA-256", new
  ArrayBuffer(0))` throws "2nd argument is not instance of ArrayBuffer…". Pass a `Uint8Array` view
  instead — accepted everywhere a buffer is, so this is a fix rather than a test workaround.
- **`import.meta.url` is not a `file:` URL under Vite.** Reading a source file from a test must
  resolve from `process.cwd()`.
- **An aborted IndexedDB upgrade escapes as an unhandled rejection** under `fake-indexeddb` unless
  the test owns every handler on the open request (`error`, `success`, `blocked`). It fails the whole
  run, not just the test.

### Dependency audit

**Verified.** `npm audit` reports 6 vulnerabilities (3 high, 3 critical). All six trace to `web-ext`
— a dev dependency added so `npm run dev` auto-opens Firefox — through `fx-runner`/`shell-quote` and
`@devicefarmer/adbkit`/`node-forge`. **None came from the inference dependencies**, and none ship in
the add-on. `npm audit fix --force` would break `wxt`.

---

## 7. Bugs found while building this

Recorded because each is the kind that passes review and fails later.

### Path traversal in hub URL construction

`encodeURIComponent` does **not** escape dots — a dot is an unreserved character. So a reference of
`../../../etc` survived escaping, and the URL parser then resolved it away:

```
https://huggingface.co/api/models/owner/model/revision/../../../etc
→ pathname /api/models/etc
```

The request would have left for a different endpoint entirely. Escaping per segment is necessary but
**not sufficient**: empty, `.` and `..` segments are now refused outright, before any request. Fixed
in `shared/huggingFace/buildHubUrl`, which both the revision and file URL builders route through.

### A test fixture that passed by accident

`"tokenizer_config.json".endsWith("config.json")` is **true**. A fixture matching stubbed responses
by URL suffix therefore served `config.json`'s body for `tokenizer_config.json`. In one spec this
passed anyway — the derived value happened to come out right — which is worse than failing, because
it masked the fault. Fixed in three specs by matching the full final path segment.

---

## 8. What the measurements say

Taken on an Apple M4 Pro, Firefox 157, with `MINILM_L6_V2` (≈22M parameters, q8) unless stated.

### It works, end to end

|                                   |                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| Install under the declared policy | **Both profiles**, with nothing refused by the policy                                 |
| Conformance, 60 probe texts       | **All five probes pass**                                                              |
| Paraphrase ordering               | **20 of 20** pairs, where 18 are required — on each profile                           |
| Determinism                       | **1.00000**, against a 0.999 bar                                                      |
| Asymmetric prefixes               | Honoured: `bge-small-en-v1.5` orders 20 of 20 despite instructing only the query side |
| Model load time                   | 0.07–0.12 s — the files come from our own store, already verified                     |

The pipeline from a pinned commit to a usable vector is sound: resolve, describe, fetch, verify,
store, load, embed, check.

### It is too slow for the budget as written

|                                          |                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| Throughput, software path, single thread | **4.0–4.4 chunks/s** (40 chunks of 220 words in 9.1–10.1 s)                      |
| NFR-004 asks for                         | **≥ 20 chunks/s**                                                                |
| Shortfall                                | **about 4.5×**                                                                   |
| Runs                                     | Four, headless and headed, with and without a warm-up batch; the spread is noise |

The budget names this exact configuration and asks for it on an M1 MacBook Air and a four-core
Linux laptop. The measurement is from faster hardware than either, so the reading is generous rather
than pessimistic. And nothing available closes a 4.5× gap: threads are impossible by platform
design, the accelerated path is irrelevant to a minimum version that has none, and build-variant or
batch tuning moves fractions.

### Still open

| Question                                          | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Throughput on the accelerated path                | **Unresolved, with a diagnosis.** WebGPU is offered by the browser, but the worker bundle statically includes the runtime's asyncify loader, which carries no WebGPU backend; requesting that device fails with `webgpuInit is not a function` whatever `wasmPaths` says. Reaching the right runtime entry is a bundling problem of its own. A characterisation test asserts the current failure, so the day it works someone comes back to measure it. |
| Event-page lifetime under a long job (spike M0-1) | **Partial evidence.** Two installs plus conformance plus a benchmark — tens of seconds of continuous work — completed over one open port with no unload and no lost reply. M0-1 asks about five minutes or more, and about what happens with no surface open.                                                                                                                                                                                           |
| Generative models (phase B)                       | **Not reached.** The gate stopped before them, deliberately: at 4 chunks/s for a 22M-parameter encoder, a 0.6B generative model on the same runtime will not extract facts from a 1500-word page inside NFR-007's 60 s.                                                                                                                                                                                                                                 |
| Cache API on `moz-extension://`                   | **Not needed.** The runtime's own cache is off; it is fed from our verified files, and model files live in the add-on's database with per-model size reporting.                                                                                                                                                                                                                                                                                         |

### The conclusion

Not "local inference does not work" — it demonstrably does, and correctly. The narrower and more
useful conclusion:

**In-extension embedding is correct and insufficient, which moves the native host earlier than the
roadmap assumed.** The target spec scheduled its `native` provider and spike M0-4 after in-extension
inference had proved itself. It has proved itself correct and too slow, which inverts that order.

What survives unchanged: the provider interface, the registry, the verification pipeline, the
conformance suite. The native provider slots in behind the same interface, and the in-extension
provider remains the no-install fallback that REQ-CLU-001 already assumes exists.
