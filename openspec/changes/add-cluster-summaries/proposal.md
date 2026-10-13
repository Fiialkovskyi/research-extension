# Proposal

## Why

The session now has grounded facts, grouped into entities. The user still reads them only as counts.
The first piece of synthesis a user can read is a cluster summary (REQ-SYN-003): a few
statements about what a group of pages says, each linked to the page and quote it came from.
Because it is built only from facts whose quotes were verified, every statement can be checked.
Summaries must also say when they no longer match what was read (REQ-LIN-006). They have to be
regenerated without getting in the user's way (REQ-SYN-004).

## What Changes

- **A versioned prompt, `clusterSummary@1`,** with its schema alongside, like `factExtraction@1`.
  - The model receives the cluster's facts as a numbered list of data: subject, attribute, value,
    unit and quote.
  - It returns at most 8 statements, each citing fact labels (`F3`).
  - Labels are mapped back to fact ids. A statement that cites no valid fact is discarded
    (REQ-SYN-003).
  - One summary is one model run (REQ-LIN-007).
- **A `summarizeCluster` job per cluster.**
  - **When it is queued.** Whenever a cluster's set of facts changes, a job is queued for no
    sooner than 60 s later (REQ-SYN-004). Its identity includes the fact set, so a change within
    the 60 s replaces it.
  - **When it runs.** It runs on the same terms as fact extraction: while the user is idle or
    locked, or when they ask (REQ-MOD-008).
  - **A superseded job.** A job whose fact set is no longer the cluster's ends without generating.
- **Large clusters.** At most 60 facts go into one summary, chosen across the cluster's entities
  and pages. The summary records how many facts it left out.
- **Storage.** A new `summaries` store, added by migration 16, with one summary per cluster.
  - Statements and their text are encrypted, as facts are.
  - The fact ids it cites, the hash of its input fact set, the model and the prompt are readable.
- **Staleness (REQ-LIN-006).**
  - A summary is stale when its cluster's fact set no longer matches its input: a fact was added
    or removed, or a page changed or was deleted.
  - It is also stale when its producer model is no longer installed.
  - It is computed when read, so nothing has to be marked.
  - A stale summary is shown dimmed, with "Refresh".
- **A "Summaries" page.** A new extension page, opened from the popup's "Summaries" button, like
  "What was recorded".
  - Each cluster shows its label and its statements.
  - Each citation links to the source page and shows the quote.
  - A cluster without a summary yet offers "Summarize now".
  - A cluster without facts says so.
  - The page makes no network request.
- **Deleting a session** deletes its summaries.

## Capabilities

### New Capabilities

- `cluster-summaries`:
  - how a cluster's facts become a cited summary;
  - when summaries are generated;
  - how staleness is decided and shown;
  - the Summaries page and the popup's way to it.

### Modified Capabilities

None. Session deletion of summaries is stated in `cluster-summaries` itself, so this change does
not depend on the unarchived `add-fact-extraction` and `add-entity-resolution` deltas to
`recorded-data`.

## Impact

- **Code:**
  - a new `features/clusterSummaries/`:
    - `prompts/clusterSummary@1.md` with its schema;
    - message building, answer reading and citation mapping;
    - the fact-set hash, staleness, the enqueue and the job;
    - the page's components;
  - `shared/storage` gains the summaries store and migration 16;
  - `jobQueue/enqueueJob` takes an optional earliest start;
  - `app/backgroundApp`:
    - the runner, under the generation gate;
    - enqueueing after resolution and reclustering;
    - `summaries.read`, `summaries.refresh` and `summaries.open`;
  - a new `entrypoints/summaries` page with an `app/summariesApp` root;
  - the popup gains the button;
  - `recordedData/deleteSession` covers summaries.
- **Tests:**
  - unit specs for the prompt guard, citation mapping, hashing, staleness, the job and the page;
  - background specs against the fake Ollama;
  - an e2e check that the popup opens Summaries and a session without facts says so.
- **The maintainer's machine:** a manual run on a session with extracted facts, recording the
  statements, their citations and the time.
- **Out of scope:**
  - the comparison table;
  - gaps;
  - rejecting statements (LIN-008);
  - the sidebar panel.

  The page's components are written so a sidebar can reuse them later.
