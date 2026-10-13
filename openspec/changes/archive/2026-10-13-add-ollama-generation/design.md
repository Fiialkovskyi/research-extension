# Design

## Context

`spike-ollama-provider` made the local Ollama server an embedding provider: a model is registered
pinned to its digest, judged by the embedding conformance suite through the server, and used like a
downloaded model. Its gate for phase B passed (conformance 20/20, 46.5 chunks/s, a real page
embedded end to end), and phase B — generation — was deferred to this change. The provider contract
in `features/inference/types.ts` was shaped for generation from the start (`GenerateRequest`,
`GenerationStream`, `stoppedBecause`), and the manifest already has a `text-generation` contract
with `structuredOutput`; neither has an implementation.

Two things in the spike's code assume embeddings and would mis-handle a generation model:

- `buildOllamaManifest` always writes an embedding contract, reading `<arch>.embedding_length` —
  which a generation model also has (its hidden size), so `qwen3:4b` would be registered as a
  2,560-dimension embedding model.
- `ollama.enable` and `findOllamaProfile` match a name on its part before the tag, so `qwen3:4b`
  would match an already pulled `qwen3:0.6b`.

## Goals / Non-Goals

**Goals:**

- Generation through Ollama that honours the provider contract: streamed, bounded by the caller's
  token limit, cancellable, and reporting why it stopped.
- Structured output that is requested from the server and validated anyway.
- A text-generation conformance suite, so a generation model goes through the same "judged before
  use" gate as an embedding one.
- One-action setup of the recommended generation model from the Ollama card, and a measurement of
  extraction time against REQ-NFR-007.

**Non-Goals:**

- Any synthesis feature (prompts, fact extraction over sessions, summaries, tables) — M4.
- Generation in the extension's own runtime. A non-Ollama generation model is refused at activation
  with a reason, as today.
- The restart check deferred from the spike.

## Decisions

### The family comes from the server

`/api/show` answers `capabilities` (`["embedding"]` for `nomic-embed-text`, `["completion", …]` for
a chat model; checked against Ollama 0.40.3 on the maintainer's machine). Registration takes the
family from it: `embedding` → embedding contract as today; `completion` → text-generation contract.
Only when the server does not say (an older Ollama) does the bundled profile decide, and with
neither, the embedding contract stays the default, so nothing that works today changes.

The text-generation contract from the server: `contextWindow` from `<arch>.context_length` (4,096
when absent), `maxNewTokens` the smaller of 2,048 and the context window, `chatTemplate: "server"`
(Ollama applies the model's own template; the field's string form names that), and
`structuredOutput: "json_schema"`, since `/api/chat` takes a JSON schema as `format`.

### Profiles become a union by family

`OllamaProfile` carries `prefixes` and `pooling`, which mean nothing for a generation model.
It becomes `OllamaEmbeddingProfile | OllamaGenerationProfile`, discriminated by `family`. A profile
whose name has a tag (`qwen3:4b`) matches only that tag; one without (`nomic-embed-text`) matches
any tag of the name, as before. One function, `matchesOllamaName`, decides this for the profile
lookup, the recommended-models list and `ollama.enable`.

`qwen3:4b` is the recommended generation model: about 2.5 GB, a 4B model in the 3B-to-4B band
REQ-NFR-007 names for the native host, which Ollama stands in for.

### The generator

`createOllamaGenerator(fetch, origin, manifest)` returns `generate(request): GenerationStream`:

- Before each run it checks, like the embedder, that Ollama is running, admits the extension and
  still has the model at its registered digest. That check moves out of `createOllamaEmbedder` into
  `assertOllamaServesModel`, shared by both.
- `POST /api/chat` with `stream: true`, `options.num_predict = maxTokens`, `options.temperature`
  when given, `format` when the request carries a response schema, and the request's `AbortSignal`
  passed to `fetch`.
- `think: false`. Qwen3 reasons before it answers by default; that spends the token budget and the
  time on text nobody reads, and makes a token limit stop before the answer starts.
- Streamed NDJSON lines yield `{ delta }`; the last line's `done_reason` gives `stoppedBecause`
  (`length` → `token-limit`, otherwise `model`). An abort gives `cancelled` and the text so far; the
  stream ending without a `done` line is an error.
- The stream can be iterated or not: `final()` resolves either way, so a caller that only wants the
  result does not have to drain it.

Cancelling releases the server: aborting the fetch closes the connection, and Ollama stops
generating for a closed request.

### Structured output: requested, then validated

`GenerateRequest` gains an optional `responseSchema` (a JSON schema object). A provider whose
contract says `json_schema` passes it to the runtime; one that says `none` ignores it.
`generateStructured({ generate, request, schema })` then parses the final text as JSON and validates
it with the caller's valibot schema, returning `{ ok: true, value }` or `{ ok: false, reason }` —
never the unvalidated text as a result. A cancelled or limit-stopped run is a failure here: its
JSON is incomplete by construction.

The caller supplies both schemas: the JSON schema the server constrains to and the valibot schema
the extension trusts. Deriving one from the other needs `@valibot/to-json-schema`, a new
dependency, for one call site so far; it can replace the hand-written JSON schemas when M4 adds
more.

### The conformance suite for text generation

`runGenerationConformance(generate)`, beside `runEmbeddingConformance`, returning the same
`ConformanceOutcome` and `ProbeResult`s so the options page shows them unchanged. In order:

1. **Stops when cancelled.** A long answer is requested and cancelled after its first delta;
   passes when the run reports `cancelled` within 5 s.
2. **Stops at its token limit.** A long answer with `maxTokens: 16`; passes when it reports
   `token-limit`.
3. **Extracts into a schema.** Five bundled passages, each describing one product with a name, a
   price and a weight, extracted with `temperature: 0` into `{ name, priceUsd, weightKg }`. A probe
   is right when its output is schema-valid, the name contains the expected one (ignoring case), and
   both numbers are within 1% of the expected ones. Passes with at least 4 of 5 right.

Cancellation runs first so that the extraction probes after it also show the server was released.

### Activation dispatches by family

`activateWithConformance` picks the suite by the contract's family. A generation model is reached
only through Ollama; for any other, the suite reports that generation runs only through the local
inference server, and activation is refused with that reason. One model per family stays active,
so the embedding and generation models are active together. Embedding of waiting snapshots is
triggered only when an embedding model is activated.

### Measuring extraction time

`generation.measure` runs one extraction over a bundled article of about 1,500 words with the
active generation model: one comparison-table row per e-bike the article reviews (name, price,
weight, battery, torque, range), the shape synthesis fills (REQ-SYN-005), into a schema, at
temperature 0, with up to 512 tokens. It answers the time it took, whether the output was
schema-valid, how many of the article's 15 numbers it got right, and whether the time is within
20 s — REQ-NFR-007's budget for a 3B-to-4B model outside the extension. The article, its known
table and the schema live in `features/inferenceBenchmark` beside the embedding benchmark.

A first version asked for every fact the article states, as `{ subject, attribute, value }`
triples. On the real model that answer had no natural end: it ran into its 1,536-token limit after
54 s of writing (28 tokens/s) and was discarded. The length of an "every fact" answer grows with
the page, so it can meet no fixed budget; a table row is bounded by its columns.

While it runs, the background posts `generation.measureProgress` every second (see Findings): the
card shows the seconds and characters so far, and the posting keeps the event page alive.

### The card's second step

Below "Local AI is on", the card offers "Turn on page summaries (optional)", saying it downloads
`qwen3:4b` (about 2.5 GB). It uses `ollama.enable` with that name, so progress, stages and failures
come through exactly as for the first step; the card tracks progress per model name. With
summaries on, it shows "Page summaries are on, using qwen3:4b" and "Measure extraction time", with
the result and a green or red dot against the budget. The "More" list shows generation models too;
"Measure speed" stays for embedding models.

## Risks / Trade-offs

- **[A 2.5 GB download]** → Offered only as an optional second step, with its size stated before
  the click, and only after local AI is on.
- **[The first run after loading is slow]** Ollama loads the model on first use, which can take
  several seconds and is counted in the first probe and the first measurement. → The measurement
  is repeatable; the design records which run is reported.
- **[Small models misextract]** → Conformance requires 4 of 5, and every structured answer is
  validated; synthesis (M4) adds grounding on top.
- **[Two hand-written schemas can drift]** → One call site each for now, both tested against the
  same sample; see the structured-output decision.
- **[No e2e against a real model]** Same reason as in the spike: the policy admits only port 11434.
  → Unit and background specs drive a fake Ollama; the run against a real one is manual (task 5).

## Findings

Recorded during implementation and the manual run.

- **Conformance passed on a real `qwen3:4b` (Q4_K_M, digest `359d7dd4bcda…`), Ollama on Apple Silicon (task 5.1, first half).** Cancellation stopped the run 0.00 s after the abort; the 16-token limit was reported as `token-limit`; extraction got 4 of 5 right, the miss being the Brewline K2's weight (2.6 kg answered, 1.2 expected — the passage's distractor is the box). The seven requests took 12 s, about 1.2 s per extraction at 37–40 tokens/s, after a 6 s model load. Ollama accepted `think: false` and `format` with a schema.
- **The event page was unloaded in the middle of a long answer.** The first extraction timing never answered the options page. Ollama's log showed the chat request ending after exactly 30.0 s, with 2,099 prompt tokens read and about 900 written: Firefox's idle timeout for an MV3 event page, which an open port alone did not prevent while the background only waited on `fetch`. Installs had survived because they post progress over the port all along. The measurement now posts progress every second (`generation.measureProgress`), which is also what the card shows. Synthesis jobs in M4 will wait on answers this long and longer, so the job runner needs the same activity, or a decision from M0-1; recorded as input to it.
- **Ollama runs `qwen3:4b` with a 4,096-token context by default** (`n_ctx_slot = 4096`), whatever the model's 40,960. The timed article (2,099 prompt tokens) plus its answer fits; longer pages in M4 will need `num_ctx` raised per request, at a memory cost.
- **REQ-NFR-007 met (task 5.1, second half).** With the table extraction, `qwen3:4b` through Ollama filled the comparison table from the 1,492-word article in 13.4 s, 15 of 15 values right, schema-valid: 5.9 s reading the 2,120-token prompt (356 tokens/s) and 7.3 s writing 215 tokens (29 tokens/s), the model already loaded. The budget is 20 s for a 3B-to-4B model outside the extension. Reading the page is close to half the time and grows with the page; writing is bounded by the table's columns.
