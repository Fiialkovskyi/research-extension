# Proposal

## Why

The product rests on one unverified assumption: that a Hugging Face model can be downloaded and executed **inside the extension** without breaking the no-remote-code and no-egress guarantees. Everything downstream — semantic clustering edges, fact extraction, summaries — is worthless if that assumption is false, and nothing built so far tests it. The target spec reserves two spikes for exactly this (§14 M0-2, Transformers.js under the extension CSP with WebGPU and WASM benchmarks against NFR-004/NFR-007; and M0-3, enumerating the Hugging Face download hosts and proving they pass `connect-src`). This change closes both.

Three platform facts, verified while planning, reshape the question the spike has to answer:

- **WASM threads are unavailable to us.** Firefox extension pages cannot become cross-origin isolated — all extensions share one process and Firefox has no manifest COOP/COEP opt-in (Bugzilla 1673477, 1674383, both open). `SharedArrayBuffer` is therefore absent and ONNX Runtime Web silently falls back to a single thread. M0-2's "with WASM threads availability" is void: single-threaded WASM is the floor, not a degraded mode.
- **WebGPU is not available at our declared minimum.** It is on by default on Apple Silicon from Firefox 145/147, but the manifest declares `strict_min_version: "140.0"` and the target spec also budgets for Linux without WebGPU. WebGPU is an accelerator; the baseline for every NFR budget is single-threaded WASM.
- **The Hugging Face host set is published machine-readably and is deeper than the docs table suggests.** `https://huggingface.co/.well-known/meta.json` lists hosts including four-label names such as `us-east1.us.gcp.cdn.hf.co`. Whether one CSP wildcard covers them is a hypothesis this spike must confirm empirically, not assume.

A fourth fact is a hard blocker rather than a risk: Transformers.js loads the ONNX Runtime WASM binaries from a public CDN by default, which violates the no-remote-code guarantee outright. They must ship in the package.

## What Changes

- Introduce a **model runtime**: the add-on can install a Hugging Face model pinned to a 40-character commit SHA, verify every file by SHA-256 before first load, store it locally, and run inference off the UI thread in a dedicated worker, reporting the compute device it actually used.
- Add the **background event page** as the single coordinator and the only writer of local storage, and the **options page** as the surface where a user installs, inspects and activates a model. Both are surfaces the `extension-shell` capability already anticipated.
- Declare a **Content Security Policy** that permits WebAssembly compilation and confines outbound connections to the extension itself plus the enumerated model-host origins. This policy is the enforcement point for the no-egress guarantee.
- **Refine the no-remote-code guarantee** to distinguish executable code from model data. Code — including the ONNX Runtime WebAssembly binaries — ships in the package. Model weights are data: downloaded on explicit user action and hash-verified. Today's requirement does not draw that line and would read as self-contradictory once a model is installed.
- Run a **conformance suite** at install time and refuse to activate a model that fails it, so a model that cannot meet its declared contract never reaches feature code.
- Record a **content-free run log** (device, duration, outcome) so throughput claims are measured rather than asserted.
- Deliver the spike's findings as durable artifacts: the verified CSP string and host list, measured embedding throughput on both WASM and WebGPU against NFR-004, a decision on `strict_min_version`, and the actual structured-output capability of the runtime.

Work proceeds in two phases with a real gate between them. Phase A covers embedding models. Phase B covers text generation and **only begins if phase A's single-threaded WASM throughput clears NFR-004** — a generative model on the same runtime would be hopeless otherwise, and the conclusion becomes "the native host is needed sooner than planned".

## Capabilities

### New Capabilities

- `model-runtime`: How the add-on obtains, pins, verifies and stores local inference models, how it executes them off the UI thread, what it guarantees about a model meeting its declared contract before use, and what it reports about the runtime and device that produced a result. It will own later provider requirements (the native host, model swapping) as they arrive.

### Modified Capabilities

- `extension-shell`: Adds the background event page and the options page as declared surfaces, adds the Content Security Policy contract that bounds outbound connections and permits WebAssembly, and refines "Package carries all of its own code" to separate shipped code from downloaded, verified model data.

## Impact

- **New code:** `src/entrypoints/{background,inferenceWorker,options}`, `src/app/optionsApp`, `src/features/{modelRegistry,modelInstall,inference,modelConformance,inferenceBenchmark}`, `src/shared/{rpc,storage,config/huggingFace,config/modelProfiles}`.
- **Modified config:** `wxt.config.ts` gains the CSP, host permissions, the options surface and the background entrypoint; the ONNX Runtime WASM binaries are copied into the package and the runtime is pinned to one thread explicitly, so the fallback is a decision rather than a silent surprise.
- **New dependencies:** `@huggingface/transformers` (4.x), `valibot` for runtime schema validation at boundaries, `idb` as a thin IndexedDB wrapper, and `fake-indexeddb` for unit tests.
- **New network behaviour:** the extension gains its first outbound requests. They are user-initiated, confined by CSP to the model hosts, carry no credentials or identifiers, and reach no other origin.
- **Testing:** unit tests beside each module; an offline end-to-end test serving model files from a local fixture so `npm run verify` stays deterministic; and a separate, opt-in network test that performs a real download and is the thing that actually answers M0-3.
- **Docs:** `README.md` gains the verified CSP and host list, how to force the WASM path, and the network-test flag; `AGENTS.md` gains the background and worker layering rule.
- **Explicitly out of scope:** local model files and the native host (the next spike, M0-4); embedding spaces (§7) — with no session and no second space, there is nothing for a space mismatch to violate yet; the graph, capture, clustering, sidebar, encryption at rest, Chrome, CI and AMO submission. The event-page idle-unload question (M0-1) is observed and reported, not resolved.
