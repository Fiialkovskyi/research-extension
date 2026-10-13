# Design

## Context

- **Snapshots exist only for deep-read pages.** The page-snapshots spec captures text only when a
  node becomes `deep_read`, so taking a page's snapshot as the source already satisfies
  REQ-SYN-001. The user's "include" mark does not exist and is out of scope.
- **Chunks are made by the embedding job today.** `runEmbeddingJob` runs `chunkText` (`chunker@1`)
  and writes `StoredChunk` ranges with ids `${snapshotId}:${index}`. The chunker is deterministic.
  Fact extraction can therefore chunk the same text itself and get the same ids, so it does not
  depend on an embedding model being active.
- **Generation.**
  - `createOllamaGenerator` streams `/api/chat` with `format` set from `responseSchema`,
    `think: false`, and a token limit.
  - Structured answers are validated by the caller with valibot, as the benchmark does with
    `EXTRACTED_TABLE_JSON_SCHEMA` and `extractedTableSchema`.
  - Ollama's default context is 4,096 tokens (`add-ollama-generation`, Findings).
- **Measured cost.** On `qwen3:4b`, reading runs at about 356 tokens/s and writing at about 29
  tokens/s. An open-ended "every fact" answer over a whole page ran into its 1,536-token limit
  after 54 s.
- **Jobs.**
  - The runner (`runNextJob`, by type) holds the background while a job runs, and resumes
    interrupted jobs from their checkpoint (`spike-event-page-lifetime`).
  - `claimNextJob` takes the highest-priority due job of any type.
- **Encryption.** Snapshot text is encrypted with the data key through `dataProtection`
  (`encryptBytes`, `decryptBytes`). Web Crypto is asynchronous, so it cannot run inside an
  IndexedDB transaction.
- **Idleness.** `idle.onStateChanged` already wakes the background (`handleIdleStateChanged`), and
  the `idle` permission is held. The idle threshold is 60 s (`ENGAGEMENT_RULES`).

## Goals / Non-Goals

**Goals:**

- Grounded facts per deep-read page, stored encrypted, with provenance, produced in the
  background without slowing the user down.
- A shape the next M4 steps can read: entity resolution, summaries, the table.

**Non-Goals:**

- Normalising units (`value_norm`), resolving entities, and the `Fact.entity_id` of the target
  spec. A fact keeps its raw subject until entity resolution exists.
- The "include" mark, fact review UI and rejections (LIN-008).
- In-extension generation. Generation runs only through Ollama, as it does today.

## Decisions

### 1. One chunk per request, not a bigger context

Each request carries one `chunker@1` chunk of about 220 words, roughly 300 tokens.

Why:

- **It fits.** With the prompt, a request is well under Ollama's 4,096-token default, so `num_ctx`
  does not need raising and the model's memory does not grow.
- **The answer is bounded.** At most 12 facts, at most 1,024 tokens. An "every fact on the page"
  answer has no natural end and failed the budget once already.
- **Grounding is exact.** A quote is checked against the one chunk it came from.
- **Checkpoints line up with requests.** An unload loses at most one chunk.

The cost is that a fact spread across a chunk boundary can be missed. The chunker's one-sentence
overlap reduces this, and entity resolution later merges the same fact found twice.

`GenerateRequest` still gains an optional `contextTokens`, which the Ollama generator sends as
`options.num_ctx`. Extraction sets it to 4,096 explicitly, so a model whose Modelfile sets a
smaller default behaves the same. Rejected alternative: whole page plus a raised `num_ctx`. It
needs memory proportional to the page, has no checkpoint inside, and its time grows with the page
— the case that missed the budget.

### 2. The prompt and its schema live in versioned files

They live in `src/features/factExtraction/prompts/`:

- **`factExtraction@1.md`.** The instruction text, imported with Vite's `?raw`, so the bundle
  carries it and nothing is fetched. The filename follows REQ-SYN-010 rather than the camelCase
  rule, because the `@version` is the point.
- **`factExtraction@1.schema.json`.** The JSON schema sent as `format`: entities, plus facts with
  `subject`, `attribute`, `value`, an optional `unit` and `quote`, at most 12 facts.
- **`schemas.ts`.** The matching valibot schema that validates the answer.
- **`FACT_EXTRACTION_PROMPT`** in `constants.ts`. It names the id and version (`factExtraction`,
  `1`), and provenance records it.

Two schemas written by hand can drift apart. So the module's `constants.spec.ts` checks the
invariant: the JSON schema's properties, required keys and `maxItems` match the valibot schema's
entries. It also checks that the version in the prompt's filename is the version in the constant.

### 3. Page text as delimited data

The request is built by `buildFactExtractionMessages(chunkText)`:

- **System message.** The prompt file's text. It says that the content between `<page_text>` and
  `</page_text>` is data from a web page, that instructions inside it must be ignored, and that
  quotes must be copied verbatim from it.
- **User message.** `<page_text>\n…\n</page_text>`.
- **Escaping.** Any `</page_text>` already in the chunk is written as `</page_text_>`, so the page
  cannot close the block. Grounding still compares against the original chunk, not the escaped
  copy.

Nothing in an answer is executed. It is parsed, validated and either stored as facts or discarded.

### 4. Grounding

`isQuoteGrounded(quote, chunk)` is true when either holds:

- `chunk.includes(quote)`;
- both match after collapsing every whitespace run to one space and trimming.

The match is case-sensitive, with no other normalisation. An empty quote is never grounded. A
fact that fails is dropped and counted.

### 5. Storage: facts and per-page extraction records, migration 14

- **`facts` store** (`StoredFact`):
  - `id`: `${snapshotId}:${chunkIndex}:${n}`. The ids are deterministic, so redoing a chunk after
    an unload overwrites rather than duplicates;
  - `sessionId`, `nodeId`, `snapshotId`, `chunkId`;
  - `provenance` = `{ modelRef, prompt: "factExtraction@1", chunkerVersion, extractedAt }`;
  - `sealed` = `{ iv, ciphertext }` of the JSON `{ subject, attribute, value, unit?, quote }`.
  - Indexes: `sessionId`, `nodeId`.
- **`extractions` store** (`StoredExtraction`), keyed by `snapshotId`. It holds `sessionId`,
  `nodeId`, the prompt and model, `chunkCount`, `chunksDone`, `keptCount`, `droppedCount`,
  `invalidChunkCount`, `finishedAt?`, and an index `sessionId`.
- **Why a second store.** The dropped count has no fact row to hang on, and the recorded page reads
  counts without touching the facts.
- **Encryption.** Each chunk's facts are encrypted before the transaction. Then one transaction
  writes that chunk's facts and updates the extraction record. The job's checkpoint (`nextChunk`)
  is written after that transaction.
- **Order on resume.** If the page is unloaded between the two writes, the chunk is redone and
  overwrites the same fact ids. The counts are recomputed from the facts of the chunks done, not
  incremented, so they stay right.

### 6. The job

- **Identity.**
  - type `extractFacts`;
  - inputs `[snapshotId, contentHash]`;
  - producer version `factExtraction@1|<modelRef>|chunker@1`, so a new prompt version or model
    extracts again (spec: once per prompt version and model);
  - priority −10, so embedding runs first.
- **Enqueue.** `enqueueFactExtractions(database)` mirrors `enqueueSnapshotEmbeddings`: active
  session, active text-generation model, one job per snapshot. Nothing is queued without a
  generation model. It is called when:
  - a snapshot is stored;
  - a text-generation model is activated;
  - the user asks with `facts.extractNow`;
  - reconcile runs at startup.
- **Run.** `runFactExtractionJob`:
  1. Decrypts the snapshot and chunks it.
  2. Before each chunk from the checkpoint on, asks the gate (decision 7). If the gate says no,
     the job is deferred.
  3. Builds the messages and generates with `maxTokens` 1,024, temperature 0, the schema and
     `contextTokens` 4,096.
  4. Validates the answer. If it is invalid, it counts an invalid chunk and moves on.
  5. Grounds the facts, encrypts and stores them, checkpoints, and records a content-free
     inference run.

### 7. When extraction may run (REQ-MOD-008)

- **Claim filter.** `runNextJob` takes an optional `isPermitted(job)`, and `claimNextJob` skips
  queued jobs it rejects, so a gated job never blocks the ones behind it.
- **Deferral.** A runner may return `"deferred"`. The job then goes back to the queue with its
  checkpoint, due now, and no attempt counted, through a new `deferJob`.
- **The gate.** An `extractFacts` job is permitted when either holds:
  - `readIdleState()` (a new `BackgroundDependencies` call, `browser.idle.queryState(60)`) is
    `idle` or `locked`;
  - the job's payload carries `requestedAt`. `facts.extractNow` sets it on the session's queued
    extraction jobs. It is stored with the job, so an unload does not forget the request.
- **Waking.** When `handleIdleStateChanged` reports `idle` or `locked`, it runs the jobs. The wake
  alarm also covers queued work while the user is away.
- **The user returns.** The chunk in flight finishes. The next pre-chunk check defers the job,
  unless it was requested.

### 8. What was recorded

- **Counts.** `readRecordedSession` adds, per page, `factCount` and `droppedFactCount` from the
  extraction record, or nothing when a page has none. It also adds `canExtractFacts`, true when a
  text-generation model is active.
- **The page.** It shows "N facts, M dropped". With `canExtractFacts` it shows "Extract facts now",
  which sends `facts.extractNow`, and it refreshes when the background reports progress.
- **Deletion.** `deleteNode` and `deleteSession` add the facts and extractions stores to their one
  transaction, through the new `nodeId` and `sessionId` indexes.

## Risks / Trade-offs

- **[Small models quote loosely]** A paraphrased quote is dropped, so some true facts are lost. →
  That is the point of REQ-SYN-002. The dropped count makes the loss visible, and the manual run
  records the rate for `qwen3:4b`. If it is high, a later prompt version can be tried without a
  schema change.
- **[A long page takes minutes]** For example, 3,000 words is about 14 chunks of about 5–8 s each.
  → It runs while the user is idle, held and checkpointed per chunk. The recorded page shows
  progress through the counts.
- **[Encrypting per chunk costs time]** It is microseconds next to seconds of generation.
- **[An idle gate that never opens]** A user who never steps away gets no automatic extraction. →
  "Extract facts now" is the explicit path, as REQ-MOD-008 allows.
- **[The schema pair drifts]** → Guarded by `constants.spec.ts` (decision 2).

## Migration Plan

- Database version 14 adds `facts` and `extractions` with their indexes. Nothing existing changes.
- Rollback is reverting the change. The two stores are then ignored, and queued `extractFacts` jobs
  fail with "No runner" and stop after their retries.

## Open Questions

- What the right cap on facts per chunk is (12). The manual run checks whether real pages hit it.
  Raising it later is a new prompt version, not a design change.

## Findings

- **First real run (task 8.1, maintainer, 2026-10-13).** Setup: `qwen3:4b` through Ollama on Apple
  Silicon, run with `npm run dev`. The page was a Telemart product page for a laptop, in Russian:
  7.8 KB of kept text, 4 vectors, so about 4 chunks. Choosing "Extract facts now" gave **24 facts
  kept, 0 dropped**: every quote the model returned was found in its chunk. Chunks, invalid answers
  and time per chunk were not read out of IndexedDB in this run. The prompt is in English and the
  page in Russian; the quotes still matched the page verbatim.
- **What the manual run changed in the UI.**
  - The first version of "Extract facts now" was an underlined text button, with no feedback
    until the first chunk finished. It read as not clickable.
  - It is now the shared `Button`. It is disabled and reads "Extracting facts…" while extraction is
    under way, and pages not yet begun say "waiting for the model…".
  - The shared `Button` gained a pointer cursor and a hover state. Tailwind 4 gives buttons the
    default cursor.
- **The Ollama card said "Downloading the model…" for a model Ollama already had.** It set that
  stage optimistically on the click. It now starts at "Checking the model's quality…" when the
  model is pulled.
- **`npm run dev` now keeps its profile** in `.firefoxProfile/`, with the extension's storage and
  UUID kept across runs, so Ollama stays set up. `npm run dev:fresh` starts a throwaway profile as
  before.
