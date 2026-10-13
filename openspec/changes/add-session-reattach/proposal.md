# Proposal

## Why

A user who saved "e-bike motors" last week and starts a new session searching "e-bike mid-drive
motors" is continuing the same research. They get a second, thinner session instead, and the two never
meet. REQ-STO-006 asks the extension to notice and offer to continue the saved session. Saving, the
library, query recording and query embeddings are all in place, so the match can be made locally the
moment the new session's root search is recorded.

## What Changes

- **Finding a match.** When the active session records its root search (its first SERP), the
  extension compares that query with the root query of every saved session that has one. A saved
  session matches when:
  - their normalised query terms overlap by at least 60% (Jaccard), or
  - an embedding model is active and the two queries' embeddings, made in the same model, have a
    cosine of at least 0.8.

  The best match is kept on the new session as a suggestion. A session is checked once, at its root.

- **The offer.** The popup shows "This looks like <saved title>. Continue that research here?" with
  "Continue" and "Keep separate".
- **Continuing reattaches.** In one transaction:
  - the saved session becomes the active session, following the current tab group, which is
    renamed to its title;
  - every record of the new session moves to it: pages, edges, snapshots, chunks, vectors and jobs;
  - the new session's clustering is dropped and the new session record removed.

  The saved session's old tabs are not reopened; its pages stay in its tree and can be resumed from
  there. Searches moved in are linked to the old root by refinement edges, as if they had been made
  in it. The session is then reclustered.

- **Keeping it separate** records that the offer was declined, so it is not made again.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `research-library`: adds the reattach offer, continuing, and declining.

## Impact

- **New code:** in `features/researchLibrary/`:
  - `findReattachCandidate`, with `utils/readQueryTerms`;
  - `reattachSession`;
  - `declineReattach`.
- **Changed code:**
  - `app/backgroundApp` checks after a commit that records the root search (off the capture queue
    when it needs the model), and handles `session.reattach` and `session.keepSeparate`;
  - `session.active`'s summary carries the suggestion;
  - the popup shows the offer.
- **Storage:** `StoredSession.reattachSuggestion?` and `reattachDeclined?`, both optional, so there is
  no migration.
- **Out of scope:**
  - matching on anything but the root query;
  - offering more than one candidate;
  - reopening the saved session's tabs on continue (Resume does that).
