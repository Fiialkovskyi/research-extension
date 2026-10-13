# Design

## Context

- **The summary pipeline.** `add-cluster-summaries` built the pattern this follows:
  - versioned prompt files with a guard;
  - fact selection (`selectSummaryFacts`) and labelled fact lines (`buildSummaryMessages`);
  - a job keyed by a fact-set hash, with a 60 s `notBefore`, inside the generation gate;
  - staleness computed on read.
- **Rejected facts.** `add-rejections` leaves rejected facts out of a cluster's fact set through
  `readClusterFactIds`.
- **Gap searches.** `add-research-gaps` opens a query in the session's group through `gaps.search`.

## Decisions

### 1. Reuse, at session scope

- **The fact set.** A session's fact set is the ids of its facts, without rejected ones. It comes
  from `readClusterFactIds` given every page node of the session as one pseudo-cluster, so
  rejections are handled the same way. Its hash is `getFactSetHash`.
- **Selection and messages.** These come from the `clusterSummaries` barrel (`selectSummaryFacts`,
  `buildSummaryMessages`), with the new prompt's instructions. To allow that,
  `buildSummaryMessages` takes the system instructions as a parameter, with the summary prompt as
  the default.

### 2. The prompt and the answer

- **The prompt.** `openQuestions@1.md` asks for at most 5 questions that someone comparing these
  things would still need answered and that the facts do not answer. Each has a `query` of at most
  8 words, made for a search engine. The facts are delimited data whose instructions are to be
  ignored.
- **The schema.** `{ questions: { question, query }[] }`, with at most 5 questions.
- **Reading the answer.** `readQuestionsAnswer` validates it, trims each field, drops empty
  entries, and caps each query at 120 characters. An invalid answer fails the job, and the queue
  retries it.

### 3. Storage (migration 19)

The `questions` store is keyed by `sessionId` and holds:

- `factSetHash`, `modelRef`, `prompt`, `generatedAt`;
- `keyId`, `iv`, and `encryptedQuestions`.

A new set replaces the old one. `deleteSession` adds the store to its session-scoped list.

### 4. The job

- **Identity.** Type `suggestQuestions`, inputs `[sessionId, factSetHash]`, producer
  `openQuestions@1|<modelRef>`, priority −20, and a `notBefore` of now + 60 s.
- **When it is queued.** `enqueueOpenQuestions(database, now)` runs beside
  `enqueueClusterSummaries`: after resolution, after reclustering, and after a rejection or a
  restore.
- **Supersession.** The runner skips a job whose hash is no longer the session's.
- **The gate.** It joins `GENERATION_JOBS`.
- **The request.** `questions.refresh` marks the job `requestedAt`, as `requestClusterSummary`
  does.

### 5. The view and the page

- **`questions.read`** returns `{ questions, isStale, isPending, canSuggest, generatedAt }`, or
  `null` without a session.
- **`SuggestedQuestions`** lists each question with "Search this" (`gaps.search`), under the label
  "Suggested by the model — check before relying on them". Stale questions are dimmed with
  "Refresh". Without questions it offers "Suggest questions", or says a generation model is
  needed.
- **Polling.** The app polls while the questions are pending, as it does for summaries.

## Risks / Trade-offs

- **[Questions the facts already answer]** → The prompt says not to ask them, and the questions are
  labelled suggestions. They cost the user nothing unless they choose to search.
- **[Another generation job]** → It runs after summaries, at the same −20 priority, and only while
  the user is idle.

## Migration Plan

Version 19 adds `questions`. Rollback ignores the store.
