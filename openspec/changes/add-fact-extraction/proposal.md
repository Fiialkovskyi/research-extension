# Proposal

## Why

Synthesis is fact-first: the summaries, the comparison table and the gaps of M4 are all built from
facts the model extracted from pages the user actually read. Each fact is tied to a quote that is
verified on the page. Nothing extracts facts yet, so this is the first M4 step and every later one
depends on it.

The pieces it needs are now in place:

- Ollama generation, with structured output (`add-ollama-generation`).
- Encrypted snapshots of deep-read pages (`add-snapshot-embeddings`).
- A job runner that keeps the background loaded through a long answer and resumes after an unload
  (`spike-event-page-lifetime`).

## What Changes

- **Versioned prompts (REQ-SYN-010).** Prompts live in versioned files, `prompts/<id>@<version>.md`,
  with their JSON schema alongside. The first is `factExtraction@1`. The prompt id and version are
  recorded with every fact, so changing a prompt means bumping its version.
- **Extraction job.** An `extractFacts` job per snapshot, so per deep-read page (REQ-SYN-001).
  - It chunks the page with the existing `chunker@1`.
  - It sends the active generation model one chunk per request, and asks for output in the
    `FactExtraction@1` schema, of at most 12 facts per chunk.
  - It checkpoints after each chunk, so an unloaded page resumes where it stopped.
- **Injection safety (REQ-SYN-011).** Page text is passed as delimited data, with an instruction to
  ignore instructions inside it. Every answer is validated against the schema, and an answer that
  fails it is discarded.
- **Grounding (REQ-SYN-002).** A fact is stored only when its quote appears in the chunk it came
  from, exactly or after whitespace normalization. Facts that fail are dropped, and the drop is
  counted per page.
- **Storage.**
  - A new `facts` store, added by migration 14.
  - A fact's text is page content: subject, attribute, value, unit and quote. It is encrypted at
    rest with the data key, as snapshot text is.
  - Ids, counts and provenance stay readable without decrypting: model ref, prompt version and
    chunker version.
- **When it runs (REQ-MOD-008).**
  - Extraction is queued only while a text-generation model is active.
  - It runs only while the user is idle, or after the user asks for it with "Extract facts now" on
    the "What was recorded" page.
  - An answer already in progress finishes; the next chunk then waits.
- **What was recorded.**
  - Each page shows how many facts it has, and how many were dropped as ungrounded.
  - Deleting a page or a session deletes its facts as well.
  - Fact text is not shown yet; reviewing facts belongs to the synthesis views that follow.

## Capabilities

### New Capabilities

- `fact-extraction`: how grounded facts are extracted from deep-read pages and stored. It covers
  the source pages, versioned prompts, page text as untrusted data, grounding, encryption at rest
  and when extraction may run.

### Modified Capabilities

- `recorded-data`:
  - the "What was recorded" page shows each page's fact counts and offers "Extract facts now";
  - deleting a page or a session also deletes its facts.

## Impact

- **Code:**
  - a new `features/factExtraction/`:
    - `model/` with the prompt builder, the answer validator, grounding, the job and the enqueue;
    - `prompts/`, holding the versioned prompt and its JSON schema;
  - `shared/storage` gains the facts store and migration 14;
  - `features/jobQueue` claims a job only when its type is permitted;
  - `app/backgroundApp`:
    - a runner for the new job type;
    - the idle gate;
    - a `facts.extractNow` message;
    - enqueueing after a snapshot is stored, and when a generation model is activated;
  - `features/recordedData` deletes facts with a page or a session, and reads their counts;
  - the recorded page shows the counts and the button.
- **Model contract:** `GenerateRequest` gains an optional context length, which Ollama receives as
  `num_ctx`. Chunk-sized requests fit in its default of 4,096 tokens; the option makes that
  explicit.
- **Tests:**
  - unit specs for the prompt, grounding, validation, the job, the gate and deletion;
  - background specs against the fake Ollama;
  - an e2e check that the recorded page shows a page's fact count from a seeded database. A real
    model is not reachable from the e2e (`spike-ollama-provider` 4.1).
- **The maintainer's machine:** a manual run with `qwen3:4b` on a real deep-read page, recording
  facts kept, facts dropped and time per chunk.
- **Out of scope:**
  - the user's "include" mark for pages that are not deep-read, which needs UI of its own;
  - entity resolution and unit normalization (next M4 item);
  - showing or rejecting individual facts (LIN-008);
  - summaries, the table and gaps.
