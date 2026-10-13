# Proposal

## Why

The in-extension provider is correct but too slow:

- **Embeddings.** `spike-huggingface-inference` measured about 4 chunks/s against NFR-004's 20,
  because Firefox extension pages cannot run WebAssembly threads.
- **Generation.** The synthesis milestone (M4) cannot run in the extension at all.

The roadmap answer was a native host (spike M0-4). The maintainer chose Ollama instead. It is a local
inference server the user may already run, it serves embeddings and structured-output generation on
the machine's own hardware, and it removes the custom host, its installer and its manifest from this
project.

Like the earlier spike, this one is gated: phase B (generation) starts only if phase A (embeddings)
proves out against a real Ollama.

## What Changes

**Phase A: embeddings through Ollama.**

- **Connecting.** The options page gains "Connect to Ollama". It asks for the optional host permission
  on `http://127.0.0.1:11434`, from the user's click, then lists the models Ollama has pulled. A
  recommended model it lacks can be downloaded by Ollama on the user's click (`POST /api/pull`,
  with progress). Ollama makes that download from its own registry, and the extension's own traffic
  stays on loopback.
- **Registering a model.** The user registers an Ollama embedding model. It is recorded like an
  installed model:
  - its identity is the Ollama model name pinned to its content digest, the immutable `sha256` Ollama
    reports, in place of a commit;
  - its contract comes from Ollama's model details (dimensions and context length) and a bundled
    profile for prefixes;
  - it stays inactive until it passes the existing embedding conformance suite, run through Ollama.
- **Using it.** Activation, embedding spaces and snapshot embedding work unchanged. The background
  routes an Ollama model's `embed` to `POST /api/embed` instead of the worker.
- **Measuring it.** The benchmark measures Ollama throughput against NFR-004 and records it in
  Findings.

**Policy changes that phase A needs:**

- The content security policy's `connect-src` adds the loopback origin `http://127.0.0.1:11434`.
  Nothing leaves the machine, and no other origin is added.
- `http://127.0.0.1:11434/*` becomes an optional host permission, requested only from the options
  page.

**Phase B, behind the gate: generation through Ollama.**

- `generate` through `POST /api/chat`, with streaming, a token limit and cancellation, and with
  `format` set to a JSON schema for structured output. Output is validated whenever the server cannot
  guarantee it.
- The two generation requirements deferred from `spike-huggingface-inference` return.
- The five extraction probes are run, and their schema-valid rate and the time for a 1,500-word page
  are recorded against NFR-007.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `extension-shell`: the outbound-connection policy admits the local inference server's loopback
  origin.
- `model-runtime`:
  - model identity admits a local server's content digest;
  - a local inference server can serve a registered model, verified by the same conformance suite;
  - in phase B, generation is bounded and interruptible, and structured output is validated.

## Impact

- **Code:**
  - `shared/modelManifest`: a reference from the Ollama hub, a `local-server` format, and no files;
  - a new `features/ollama/` (`readOllamaModels`, `buildOllamaManifest`, `createOllamaProvider`);
  - `app/backgroundApp` routes by the model's hub;
  - the options page gains connect, list and register.
- **Config:** Ollama model profiles, with prefixes for `nomic-embed-text` and none for `all-minilm`.
- **Manifest:** `connect-src` and `optional_host_permissions` gain the loopback origin.
- **The maintainer's machine:** verifying phase A needs Ollama installed and an embedding model
  pulled, for example `ollama pull nomic-embed-text`. Phase B needs a generation model, for example
  `ollama pull qwen3:4b`. Nothing here installs software.
- **Tests:** unit tests use a stubbed `fetch`, and an e2e spec uses a fake Ollama-compatible server on
  the page server. The real run is manual and recorded in Findings.
