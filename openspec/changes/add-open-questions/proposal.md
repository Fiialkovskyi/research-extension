# Proposal

## Why

The rule-based gaps find what a table or a source list shows is missing. They cannot notice what
a person comparing these things would ask next, such as "does the battery come out?" or "is
there a warranty in Ukraine?". REQ-SYN-008 allows up to 5 questions proposed by the model,
labelled as suggestions. This is the last open part of M4.

## What Changes

- **A versioned prompt, `openQuestions@1`,** with its schema and guard, like the other prompts.
  - It receives up to 60 of the session's facts, selected and labelled as summaries select them.
  - It returns at most 5 questions, each with a short search query.
  - Questions are suggestions: they cite nothing, and the page labels them so.
- **A `suggestQuestions` job per session.**
  - It is queued 60 s after the session's fact set settles, and keyed by that set, so a newer one
    supersedes it.
  - It runs only while the user is idle or asks (REQ-MOD-008), and is held like every job.
  - It is skipped when a question set for the current facts and model already exists.
  - Rejected facts are left out of its input.
- **Storage.** A `questions` store, added by migration 19, holds one record per session: the
  fact-set hash, the model and the prompt, with the questions encrypted. Questions are deleted
  with their session and are stale when the fact set or the model changes.
- **The page.** Below the gaps, the Synthesis page lists "Suggested questions", labelled "suggested
  by the model".
  - Each question has "Search this", which runs through the same in-session search.
  - The section offers "Suggest questions" (or "Refresh" when they are stale), which runs the job
    at once.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `research-gaps` (from `add-research-gaps`, not yet archived): the questions the model suggests
  are added as new requirements. This change must be archived after `add-research-gaps`.

## Impact

- **Code:**
  - a new `features/openQuestions/`, with the prompt, answer reading, the job, the enqueue, the
    view and the request;
  - `clusterSummaries/selectSummaryFacts` and `buildSummaryMessages` are reused through their
    feature's barrel;
  - `shared/storage` gains the store and migration 19, and `deleteSession` covers it;
  - `app/backgroundApp` gains the runner, which joins the generation gate, plus the enqueue after
    resolution, after reclustering and after rejections, and the `questions.read` and
    `questions.refresh` messages;
  - the Synthesis page shows the section.
- **Tests:**
  - unit specs for the guard, answer reading, the enqueue, the job and the view;
  - background specs against the fake Ollama;
  - component and app specs;
  - an e2e check of the section's empty state without a generation model.
- **The maintainer's machine:** a manual run, deferred like the others.
