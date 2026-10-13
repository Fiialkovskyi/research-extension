# Tasks

## 1. Model

- [x] 1.1 Add `findReattachCandidate/utils/readQueryTerms`. Its spec covers hyphenated words kept, punctuation split, stop words and single characters dropped, and case.
- [x] 1.2 Add `findReattachCandidate`. Its spec covers:
  - a term match at 0.67;
  - no match for an unrelated query;
  - a meaning match through a stubbed `embedQueries`;
  - the best of two candidates;
  - no root meaning no candidate;
  - sessions that are not saved ignored.
- [x] 1.3 Add `StoredSession.reattachSuggestion?` and `reattachDeclined?`, `reattachSession` and `declineReattach`. The specs cover:
  - every record moved to the saved session;
  - the saved session active on the current group;
  - the new session and its clustering gone;
  - refusal when the statuses are wrong;
  - declining.

## 2. Background and popup

- [x] 2.1 Add the schemas: the summary's `reattachSuggestion`, `session.reattach`, `session.keepSeparate`, and their answers.
- [x] 2.2 In `app/backgroundApp`:
  - check for a candidate after the root search is recorded, embedding when a model is active, and store the suggestion on the queue;
  - handle continue (rename the group, link refinements, recluster, push) and keep separate.

  The specs cover:
  - a suggestion after a matching first search;
  - none for an unrelated one;
  - continuing merges;
  - declining hides it.

- [x] 2.3 Popup: the offer with "Continue" and "Keep separate". Add specs.

## 3. End-to-end and documentation

- [x] 3.1 Add `e2e/specs/sessionReattach.e2e.ts`:
  1. Save a session whose first search is `e-bike motors`.
  2. Start another and search `e-bike mid-drive motors`. The popup offers to continue.
  3. Continue. The database holds one active session with both searches, the second a refinement of the first, and the group is renamed.

  Verify that `npm run test:e2e` passes.

- [x] 3.2 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md` STO-006 with what is built, and how "60% of terms" is read (Jaccard). Verify that `openspec validate add-session-reattach --strict` passes.
- [x] 3.3 Run `npm run verify` and confirm that it passes.
