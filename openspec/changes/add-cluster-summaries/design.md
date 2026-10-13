# Design

## Context

- **Clusters.** A session's latest clustering is one `StoredClustering` per session
  (`readClustering`). Its clusters carry a stable `id`, a `label` and `memberIds` (node ids).
  Cluster ids survive recomputes while a cluster keeps most of its pages.
- **Facts.**
  - Facts are stored per page, `StoredFact.nodeId`, with their text encrypted and decrypted by
    `readSealedFact`.
  - `entityId` points at the entity a fact was first assigned to; following `mergedInto` gives
    the root.
  - Fact ids are `<snapshotId>:<chunk>:<n>`, so a page captured again yields new ids.
- **Generation.**
  - The Ollama generator and the versioned-prompt pattern come from `add-fact-extraction`: prompt
    file plus JSON schema, a valibot mirror, and a guard spec.
  - The job queue gates text generation on idleness or an explicit request, through `isPermitted`
    and the job's `requestedAt`.
- **Pages.** "What was recorded" is an unlisted extension page that the background opens through
  `openRecordedPage` (`openMapTab` with its path). The popup has a button for it.

## Goals / Non-Goals

**Goals:**

- A readable, cited summary per cluster, regenerated on the generation schedule, and honest about
  being out of date.
- A page whose components a sidebar can host later without rework.

**Non-Goals:**

- The comparison table, gaps, rejections, and the sidebar itself.
- Summaries of a single page without a cluster. Every page belongs to some cluster.

## Decisions

### 1. The input: numbered facts as delimited data

- **Labelling.** `buildSummaryMessages(facts)` numbers the selected facts `F1…Fn`.
- **System message.** The prompt file. It says that what is between `<facts>` and `</facts>` is
  data taken from web pages, that instructions inside it must be ignored, and that every
  statement must cite the labels it rests on.
- **User message.** One line per fact, `F3 | Volta E5 | weight | 23.5 kg | "weighs 23.5 kg"`,
  between `<facts>` and `</facts>`. Delimiters already in the text are escaped, as extraction
  does.
- **Why labels and not ids.** Short labels cost fewer tokens than fact ids, and a model cannot cite
  a fact it was not shown by guessing an id.

### 2. The answer and citation mapping

- **Schema, `clusterSummary@1`.** `{ statements: { text, facts: string[] }[] }`, with at most 8
  statements.
- **Mapping.** `readSummaryAnswer` validates the answer, then maps labels to fact ids. Unknown
  labels are dropped, and a statement left with none is discarded (REQ-SYN-003). An invalid
  answer fails the run: the job fails, and the queue retries with backoff.
- **Request.** `maxTokens` 1,024, temperature 0, and `contextTokens` 8,192. Sixty facts at about
  45 tokens each, plus the prompt and the answer, exceed Ollama's 4,096 default. `qwen3:4b`
  supports 40,960.

### 3. Choosing at most 60 facts

`selectSummaryFacts(facts, 60)`:

1. Groups facts by their root entity, or by subject when they have none.
2. Orders the groups by size, then by name.
3. Takes one fact per group in turn, preferring a page not yet used within the group, until it has 60.

Every entity and page is represented before any gets a second fact. The rest are counted as
`omittedFactCount`.

### 4. Fact sets, debounce and supersession

- **The fact-set hash.** `getFactSetHash(factIds)` is the SHA-256 of the sorted ids, joined.
- **Enqueue.** `enqueueClusterSummaries(database, now)` runs for the active session's clustering.
  For each cluster with facts:
  - it computes the hash;
  - it skips the cluster when its stored summary has that hash and was produced by the active
    model;
  - otherwise it queues `summarizeCluster` with inputs `[sessionId, clusterId, hash]`, producer
    version `clusterSummary@1|<modelRef>`, payload `{ clusterId, factSetHash }`, and an earliest
    start of now + 60 s.
- **Earliest start.** `enqueueJob` gains an optional `notBefore`, which sets `nextAttemptAt`.
- **Debounce.** A change within the 60 s produces a new hash and therefore a new job. When the old
  job runs, it finds its hash is no longer the cluster's and completes without generating. One
  generation therefore happens per settled fact set.
- **Callers.** It is called after a `resolveEntities` job, after a recluster, and after a page is
  deleted. Those are the points where a cluster's fact set or membership can change. It queues
  nothing without an active text-generation model.

### 5. When it runs

`summarizeCluster` joins `extractFacts` in the generation gate: the user must be idle or locked, or
the job's payload must carry `requestedAt`. The job runs held, like every job.

`summaries.refresh { clusterId }` queues the cluster's job for its current hash with `requestedAt`
and no delay, marking an already queued one the same way, then runs the jobs. It serves "Refresh"
and "Summarize now".

### 6. Storage (migration 16)

A `summaries` store (`StoredSummary`), keyed `<sessionId>:<clusterId>`, holds:

- `sessionId`, `clusterId`;
- `factSetHash`, `citedFactIds`, `inputFactCount`, `omittedFactCount`;
- `modelRef`, `prompt`, `generatedAt`;
- `keyId`, `iv`, and `encryptedStatements` = JSON `{ text, factIds }[]`.

It has an index on `sessionId`. A new summary replaces the cluster's old one. `deleteSession` adds
the store to its session-scoped list. Page deletion leaves summaries in place, where they show as
stale until regenerated.

### 7. Staleness, computed on read

`isSummaryStale(summary, currentFactSetHash, installedModelRefs)` is true when the hashes differ or
the model is not installed. It is computed by `summaries.read`, so no record needs updating when a
page is deleted or a model removed (REQ-LIN-006).

### 8. The Summaries page

- **Opening it.** `summaries.open` opens or selects the page through a new `openSummariesPage`
  dependency (`openMapTab` with `SUMMARIES_PAGE_PATH`). The popup shows "Summaries" wherever it
  shows "What was recorded".
- **`summaries.read`** returns:
  - the session's clusters in clustering order, each with its label and fact count, and its
    summary when it has one;
  - for a summary: its statements, decrypted, with each citation resolved to the cited fact's page
    title, URL and quote (decrypted), plus `isStale` and `omittedFactCount`;
  - `canSummarize`, true when a text-generation model is active.
- **Components.** `ClusterSummaries` in `features/clusterSummaries/ui`, which a sidebar can reuse.
  - Citations are links (`target="_blank"`), followed by the quote in a `<q>`.
  - Stale summaries are dimmed with "Refresh".
  - The page reads again every 3 s while a refresh it asked for is pending, as the recorded page
    does.
- **`app/summariesApp`** is the composition root, `entrypoints/summaries` the HTML and its mount.

## Risks / Trade-offs

- **[A statement says more than its facts]** The model can generalise beyond what it cites. → Each
  statement shows its citations beside it, and REQ-LIN-008 rejections come later. The prompt asks
  for one claim per statement, and nothing beyond the cited facts.
- **[A context of 8,192 tokens uses more memory]** → Only for summaries, and only while
  generating. Extraction keeps 4,096.
- **[Summaries lag reading]** It takes 60 s, plus idleness. → "Summarize now" or "Refresh"
  override that, and staleness says when the lag matters.
- **[Superseded jobs pile up]** Each completes at once without work, and done jobs are cheap
  rows. The queue already keeps them for idempotence.

## Migration Plan

- Version 16 adds `summaries`. Nothing existing changes.
- Rollback: the store is ignored, and queued `summarizeCluster` jobs fail with "No runner".
