# Design

## Context

See proposal.md — Why for motivation and for the three verified platform facts that shape this design.

What exists today is a popup-only add-on: one toolbar action, a React tree, no background context, no storage, no network behaviour. So this change does not extend an inference layer, it introduces one, along with the first background context and the first outbound request the extension has ever made. The target spec's §2, §3 and §6 already prescribe the shape (background event page as single writer and coordinator; a dedicated worker for in-extension models; providers behind one interface), and the value of following it now is that nothing here has to be dismantled later.

Two constraints dominate every decision below:

- **Single-threaded WASM is the performance floor**, not a fallback, because extension pages in Firefox cannot be cross-origin isolated. Any design that quietly depends on threads is unsound.
- **The declared minimum is Firefox 140**, which predates WebGPU on every platform. A design that only performs acceptably with WebGPU is a design that only works on recent Apple Silicon.

## Goals / Non-Goals

**Goals:**

- Produce measurements, not impressions: throughput on both compute paths, against the NFR-004 budget, recorded in Findings below.
- Prove the download path end to end — pinned revision, digest verification, policy-bounded transport — on real Hugging Face infrastructure.
- Leave behind a model runtime that the clustering and synthesis changes can build on without rework: one provider interface covering both model families, a registry as the only way to reach a model, a content-free run log.
- Keep `npm run verify` offline and deterministic despite the change's subject being a network download.

**Non-Goals:**

- Deciding where inference is hosted long-term. That is M0-1's question (does an event-page unload kill a long-running worker). This design observes and reports; it does not resolve.
- Embedding spaces (§7). A space identifier is only meaningful once two of them can be confused, which needs a session and a second model in anger. Deferred deliberately, not forgotten.
- Model swapping, re-embedding migrations, retention windows (§7 REQ-LIN-003/004).
- Any quality judgement about the models themselves beyond the conformance probes.

## Decisions

### Transformers.js over driving ONNX Runtime Web directly

Transformers.js supplies tokenizers, pooling, chat templates and the Hugging Face file layout — all of which we would otherwise reimplement, and all of which are where subtle correctness bugs live (wrong pooling silently produces plausible but useless vectors). The cost is a layer we do not control between us and the runtime, which matters most for the two things we must control: where WASM binaries come from and how many threads are used. Both are configurable, so the trade is worth it.

Alternative considered: `onnxruntime-web` directly, with our own tokenizer. Rejected — it moves tokenizer correctness into our test burden for no gain on the questions this spike asks.

### ONNX Runtime binaries ship in the package, with one thread, explicitly

Transformers.js resolves the runtime's `.wasm` and `.mjs` artefacts from a public CDN by default. Under our policy that request is blocked, and even if it were allowed it would violate the no-remote-code guarantee. So the binaries are copied into the package at build time and the runtime is pointed at the packaged path.

Thread count is set to one explicitly rather than left to the runtime's own detection. The runtime would otherwise request threads, find `SharedArrayBuffer` missing, and fall back silently — which is the same observable behaviour but an unobservable decision. Setting it means a future change of platform behaviour shows up as a deliberate edit rather than a mysterious speed-up.

### The background owns the worker; the options page holds a port

§3 assigns the dedicated worker to the background event page and makes the background the only writer of storage. Following that now costs little and avoids a later teardown. The options page is a view: it opens a long-lived port, sends intents, and renders progress streamed back.

The port is also an instrument. Whether an open port keeps the event page alive across a multi-minute download and inference is precisely the uncertainty M0-1 exists to settle, so this design records what it observes and hands that to M0-1 rather than concluding from it.

Alternative considered: the options page owning the worker and writing storage itself. Simpler for a spike and wrong for a production slice — it inverts §3's single-writer rule, so the first real feature would have to undo it.

### A provider interface covering both families from the start

The provider abstraction is written against both embedding and text generation before either is implemented, even though phase B may never run. Designing it around embeddings alone produces an interface shaped by batch-in, vectors-out, which a streaming, cancellable, template-rendering generation call does not fit — and phase B would rewrite it. The cost is a slightly wider interface than phase A needs; the benefit is that the gate can be a genuine stop rather than a commitment to refactor.

### Two digest algorithms, recorded per file

Verification uses the strongest digest the source actually publishes for each file: SHA-256 for the weights, and the pinned commit's git object hash for the small configuration files. The manifest records which algorithm applies, so it never claims a SHA-256 it never had.

The alternative was computing a SHA-256 of the small files on first download and pinning that. It reads stronger and is weaker: it trusts whatever arrived first, where the git object hash is published by the hub and tied to the commit the install is pinned to. The requirement in the spec delta was reworded to match what is verifiable rather than left promising what it cannot deliver.

### Model files: verify ourselves, store ourselves

Transformers.js caches fetched files through the browser's Cache API. That is convenient and gives us neither of the two things the spec requires: a digest check before first load (REQ-MOD-003) and a known disk-use figure per model (REQ-LIN-004, REQ-STO-009). So acquisition is ours — fetch, digest, store — and the runtime is pointed at what we stored.

Whether the Cache API is even available and persistent on `moz-extension://` is recorded in Findings regardless, because it determines whether this is a correctness decision or also a necessity.

### One policy wildcard, pending empirical confirmation

The connection allowlist is written as the extension itself, `huggingface.co`, and a single wildcard over the `hf.co` suffix. The CSP grammar describes a wildcard host as matching subdomains at any depth, which would cover the four-label CDN names; enterprise proxy documentation warns the opposite for proxies, which is a different matcher and does not apply. This remains a hypothesis until the network test confirms it, and the test enumerates what was actually blocked rather than assuming success.

Blocked origins are collected by listening for policy-violation events on the page, which names each blocked URI precisely and needs no additional permission. Reading request logs would require the `webRequest` permission, which is a disproportionate and permanent cost for a one-off measurement.

### Schema validation at boundaries with valibot

§1 requires runtime schema validation at every boundary and names zod or valibot. Valibot's modular exports keep far less in the bundle, which matters against the 300 KB per-surface budget in REQ-UI-007. It validates the RPC envelope in phase A and generated output in phase B.

### Deterministic tests offline, the real download opt-in

The subject of this change is a network download, and letting that into `npm run verify` would make the project's main gate depend on CDN weather. So the suite splits: unit tests and an end-to-end test served by a local fixture stay in `verify`; a separate opt-in run performs the real download and is the thing that answers M0-3. §13 already anticipates offline fixture serving, so this follows the testing strategy rather than inventing an exception to it.

### The phase gate is a stop, not a checkpoint

If single-threaded WASM embedding throughput falls well short of NFR-004, phase B does not start. A generative model is one to two orders of magnitude more work per token than an embedding model; if the cheap case misses its budget, the expensive case cannot meet NFR-007, and the honest conclusion is that the native host (§6 provider `native`, spike M0-4) must come before in-extension generation. Spending phase B's effort to confirm an inevitability is the waste the gate exists to prevent.

## Risks / Trade-offs

- **Single-threaded WASM misses NFR-004 on the reference hardware** → This is the spike's central question rather than a risk to avoid. Mitigation is the gate: the answer redirects the roadmap toward the native host instead of invalidating work already done.
- **WebGPU numbers flatter us.** Measuring only on an M4 Pro with Firefox 157 would produce throughput the declared minimum platform cannot reach → Measure both paths, forcing the software path by preference rather than trusting the default, and treat the WASM number as the one that governs budgets.
- **The host list changes under us.** Hugging Face states explicitly that its storage and CDN endpoints evolve → Treat the published metadata endpoint as the source of truth at build time rather than copying hostnames into code by hand, and prefer the suffix wildcard over an enumeration that silently rots.
- **The event page unloads mid-download** → Acquisition is resumable and keyed so a repeat is a no-op, which is the cheap form of REQ-STO-010. Full job checkpointing is out of scope here.
- **The provider interface is designed against one implemented family** → Accepted. Phase B is the test of whether it was designed well, and finding out there is cheaper than discovering it during the synthesis change.
- **A model that passes conformance is still bad at the real task.** Conformance probes ordering and determinism, not usefulness → Out of scope; §13's prompt evals are the mechanism, and they need the synthesis pipeline to exist.
- **Deferring embedding spaces leaves vectors unlabelled** → Vectors produced here are measurements, not durable data, and nothing persists them as graph state. The clustering change introduces spaces before any vector is stored for reuse.

## Findings

<!-- Filled in as the spike runs. These are the change's actual output; durable
     conclusions get promoted into the spec delta and README before archive. -->

| Question                                                                       | Finding                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified `connect-src` value                                                   | _pending_                                                                                                                                                                                                                                                                                                                                                     |
| Hosts actually contacted during a real install                                 | _pending_                                                                                                                                                                                                                                                                                                                                                     |
| Is the published host metadata endpoint usable at build time                   | _pending_                                                                                                                                                                                                                                                                                                                                                     |
| Embedding throughput, software path, single thread                             | _pending_                                                                                                                                                                                                                                                                                                                                                     |
| Embedding throughput, hardware-accelerated path                                | _pending_                                                                                                                                                                                                                                                                                                                                                     |
| Verdict against NFR-004 (≥ 20 chunks/s)                                        | _pending_                                                                                                                                                                                                                                                                                                                                                     |
| Recommendation on `strict_min_version`                                         | _pending_                                                                                                                                                                                                                                                                                                                                                     |
| Cache API availability and persistence on `moz-extension://`                   | _pending_                                                                                                                                                                                                                                                                                                                                                     |
| Does an open port keep the event page alive through a long job (input to M0-1) | **Yes, for jobs of this length.** An install of two models followed by conformance and a benchmark — tens of seconds of continuous work — completed over one port from the options page, with no unload and no lost reply. This is evidence for M0-1, not an answer to it: M0-1 asks about five minutes or more, and about what happens with no surface open. |
| Second model with role prefixes: contract honoured                             | _pending_                                                                                                                                                                                                                                                                                                                                                     |
| Disk footprint of each profile against NFR-005 (≤ 150 MB)                      | _pending_                                                                                                                                                                                                                                                                                                                                                     |
| Phase gate outcome                                                             | _pending_                                                                                                                                                                                                                                                                                                                                                     |
| Structured-output capability of the runtime (phase B)                          | _pending_                                                                                                                                                                                                                                                                                                                                                     |
| Schema-valid rate over the extraction probes (phase B)                         | _pending_                                                                                                                                                                                                                                                                                                                                                     |
| Fact extraction time for a ~1500-word page against NFR-007 (phase B)           | _pending_                                                                                                                                                                                                                                                                                                                                                     |

## Gate outcome: stop before phase B

**Measured:** 4.0–4.4 chunks/s. **Budget (NFR-004):** 20 chunks/s. **Shortfall:** about 4.5×.

The budget names this exact configuration — in-extension provider, a model of around 30M
parameters, q8, WASM — and asks for it on two reference machines: an M1 MacBook Air and a
four-core Linux laptop. The measurement was taken on an M4 Pro, which is faster than both. So the
figure is not a pessimistic reading of the budget; it is a generous one.

Nothing available closes a 4.5× gap:

- **Threads are impossible, not merely absent.** Firefox extension pages cannot be cross-origin
  isolated, so `SharedArrayBuffer` does not exist and the runtime is pinned to one thread. This is
  platform design, not configuration (§1 of `LLM_RESEARCH.md`).
- **The accelerated path cannot rescue the baseline even if it worked.** The manifest declares
  Firefox 140 as the minimum, which has no WebGPU on any platform, and the target spec separately
  budgets for a Linux machine without it. A figure from the accelerated path would describe
  hardware the add-on does not require.
- **Tuning moves single digits.** Build variant, batch size and chunk length are worth a fraction,
  not a multiple.

### What follows from it

Phase B is **not started**. A 0.6B generative model on this runtime is one to two orders of
magnitude more work per token than a 22M-parameter encoder; if the cheap case misses its budget by
4.5×, measuring the expensive one would spend days to confirm an inevitability. That is precisely
what the gate existed to prevent.

The conclusion is **not** that local inference is unworkable. It is narrower and more useful:

- **In-extension embedding works and is correct.** Both bundled profiles install, verify, pass every
  conformance probe and produce usable vectors — 20 of 20 ordering on each, determinism exactly
  1.00000. The pipeline from a pinned commit to a vector is sound end to end.
- **In-extension embedding is too slow for the budget as written.** At ~4 chunks/s, the 40
  deep-read pages of a typical session (§12's reference workload) cost minutes of continuous
  single-threaded work.
- **So the native host moves earlier than planned.** The target spec's §6 `native` provider and
  spike M0-4 were scheduled after in-extension inference proved itself. It has proved itself correct
  and insufficient, which inverts that order.

### What the roadmap should do instead

1. Run spike **M0-4** (native messaging round trip) next, rather than after M1.
2. Re-examine **NFR-004** against what in-extension inference can actually deliver. Either the budget
   is wrong for the platform, or embedding belongs in the native host too — and that is a product
   decision, not a performance one.
3. Keep this change's model runtime. It is the provider interface, the registry, the verification
   pipeline and the conformance suite; the `native` provider slots in behind the same interface, and
   the in-extension provider stays as the no-install fallback that §5's REQ-CLU-001 already assumes.

## Open Questions

- Which model profiles ship as the recommended defaults per hardware tier (REQ-MOD-007). The spike installs two embedding models to prove the registry is not hardwired to one, but choosing defaults needs the benchmark numbers first, and §15 already assigns that decision to an architecture decision record after M0-2.
- Whether model weights belong in the add-on's own storage or in the browser's cache storage once disk-use reporting and eviction behaviour are both understood. Phase A records the behaviour; the choice can change later without touching any requirement, since the spec constrains verification and visibility rather than the storage mechanism.
