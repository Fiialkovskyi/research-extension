# Proposal

## Why

Synthesis (M4) — fact extraction, cluster summaries, the comparison table — needs a model that
writes text, and the extension has none: `spike-huggingface-inference` stopped generation at its
gate, and `spike-ollama-provider` passed its gate for phase B, generation through the local Ollama
server, and deferred it to this change. Without it, every M4 item is blocked.

## What Changes

- **A text-generation model can be served by Ollama.** Registering an Ollama model takes its
  family from what the server says it can do (`capabilities` from `/api/show`), not from a guess,
  so a generation model is no longer described as an embedding one. A bundled profile recommends
  `qwen3:4b` for page summaries.
- **`createOllamaGenerator`**: generation through `POST /api/chat`, streamed, with the caller's
  token limit, cancellation, and the reason it stopped; the model is checked to still be the
  registered one before every call, as for embeddings. Structured output asks the server for a JSON
  schema, and the answer is still validated against the caller's schema and discarded on failure.
- **A conformance suite for text generation**, run through the same activation path as the
  embedding one: bundled extraction probes answered in a schema, a run that must stop at its token
  limit, and a run that must stop when cancelled. A generation model is unusable until it passes.
- **Options:** once local AI is on, the Ollama card offers an optional second step, "Turn on page
  summaries", which in one action downloads the recommended generation model, checks it and turns it
  on, with one progress; and a measurement of extraction time for a page of about 1,500 words,
  against REQ-NFR-007.
- The two generation requirements deferred from `spike-huggingface-inference` return to
  `model-runtime`, the structured-output one tightened to validate always.

Out of scope: any synthesis feature itself (prompts, fact extraction, summaries — M4), generation
in the extension's own runtime, and the deferred restart check from the Ollama spike.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `model-runtime`: adds bounded, interruptible generation; validated structured output; the
  text-generation conformance suite; serving a generation model through the local inference
  server; and the optional "page summaries" step in the options surface's setup.

## Impact

- `src/features/ollama/`: `buildOllamaManifest` (family from the server), `createOllamaGenerator`,
  a shared check that the server still serves the registered model, the card's second step and
  measurement, schemas for `/api/chat`.
- `src/features/modelConformance/`: `runGenerationConformance` and its bundled probes.
- `src/features/inference/types.ts`: `GenerateRequest` gains an optional response schema.
- `src/shared/config/ollama/`: the profile becomes a union by family; `qwen3:4b` added.
- `src/app/backgroundApp/`: activation dispatches by family; `ollama.enable` matches a tagged name
  exactly; a `generation.measure` request.
- No new permission, origin or dependency: everything goes to the same loopback server.
