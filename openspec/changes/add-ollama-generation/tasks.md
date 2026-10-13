# Tasks

## 1. Profiles and registration

- [x] 1.1 Make `OllamaProfile` a union by family, add `qwen3:4b` as the recommended generation profile, and add `matchesOllamaName` (a tagged profile matches only its tag). Use it in `findOllamaProfile`, `listOllamaModelEntries` and the background's `ollama.enable`. Specs.
- [x] 1.2 `buildOllamaManifest`: read `capabilities` from `/api/show` and write a text-generation contract for a completion model (context window, token limit, `chatTemplate: "server"`, `structuredOutput: "json_schema"`); fall back to the profile, then to embedding. Specs.

## 2. Generation

- [x] 2.1 Lift the "Ollama still serves this model" check out of `createOllamaEmbedder` into `assertOllamaServesModel`. Specs.
- [x] 2.2 Add `responseSchema` to `GenerateRequest`, and `createOllamaGenerator`: `/api/chat` streamed, `think: false`, token limit, temperature, `format`, cancellation, `stoppedBecause`, `final()` without draining. Specs against recorded answers.
- [x] 2.3 Add `generateStructured`: parse and validate the final text, discard on failure, treat a cancelled or limit-stopped run as a failure. Specs.

## 3. Conformance and activation

- [x] 3.1 Add `runGenerationConformance` with the bundled extraction probes, the token-limit probe and the cancellation probe. Specs.
- [x] 3.2 Background: activation picks the suite by family; generation only through Ollama; embedding of snapshots only after an embedding activation. Background specs against a fake Ollama that chats.
- [x] 3.3 Add `measureExtractionTime` with the bundled ~1,500-word article and its known comparison table, checking the answer as well as timing it, progress every second, and the `generation.measure` request. Specs.

## 4. Options

- [x] 4.1 Ollama card: the optional "Turn on page summaries" step, progress per model name, "Page summaries are on", "Measure extraction time" with its result; generation models in "More". Specs.
- [x] 4.2 README: the page-summaries step for a first-time user. Run `npm run verify`.

## 5. Manual run

- [x] 5.1 On the maintainer's machine, turn on page summaries from the card, record the conformance probes and the extraction time against REQ-NFR-007 in Findings.
