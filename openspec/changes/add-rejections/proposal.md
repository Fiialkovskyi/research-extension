# Proposal

## Why

A model can extract a wrong fact with a real quote, for example a misread number or the weight of
the box rather than the bike. Grounding cannot catch it. Until now the user could see such a fact
in the table or in a summary, but could do nothing about it. REQ-LIN-008 asks for a rejection:
the user marks a statement wrong once, and no model shows it to them again in that session, the
current one or any that replaces it.

## What Changes

- **Rejecting a value.**
  - In the comparison table, every value a cell lists gets "Wrong".
  - In a summary, every citation gets "Wrong".
  - Choosing it stores a rejection for each fact behind it. The rejection is keyed by a hash of
    the fact's subject, attribute and value, normalised: names and text through
    `normalizeEntityName`, numbers through `unitNormalizer@1`. So "23 500 g" and "23.5 kg" are one
    rejection.
- **Suppression.** A rejected fact is left out everywhere a fact is used:
  - table cells, and so gaps and the CSV;
  - the facts a summary is built from, and so its fact-set hash.
  - A summary that cited it therefore becomes stale and is regenerated without it.
  - The fact itself is kept, so a rejection can be undone. A later extraction by any model, of a
    fact with the same key, is suppressed the same way.
- **Undoing.** The Synthesis page says how many values were rejected, with "Restore all".
- **Storage.**
  - A `rejections` store, added by migration 18, holds `{ sessionId, hash, createdAt }` per
    rejection. The hash is SHA-256 of the normalised triple, so the store holds no readable
    content.
  - Rejections are deleted with their session.

## Capabilities

### New Capabilities

- `fact-rejections`: how a fact is rejected, how rejected facts are kept out of every synthesis
  view, and how rejections are undone.

### Modified Capabilities

None. Where the views leave rejected facts out is stated in `fact-rejections`, so the unarchived
synthesis changes need no second delta.

## Impact

- **Code:**
  - a new `features/factRejections/`:
    - `getFactKey`;
    - `readRejectedKeys`, `rejectFacts`, `restoreRejections`;
    - `filterRejectedFacts`;
  - `comparisonTable/readComparisonTable` and `clusterSummaries/readClusterFactIds` filter
    rejected facts. The second now decrypts, so it takes the data key;
  - the summary view drops citations of rejected facts;
  - `shared/storage` gains the store and migration 18, and `deleteSession` covers it;
  - `app/backgroundApp` answers `facts.reject` and `facts.restoreRejections`;
  - the table and summary components gain "Wrong", and the page gains the count with
    "Restore all".
- **Tests:**
  - unit specs for the key (normalisation equivalences), rejecting, restoring and filtering;
  - specs that the table, the fact set and citations leave rejected facts out;
  - component and app specs;
  - an e2e check that the page shows no rejection count before any rejection.
- **Out of scope:**
  - rejections shared across sessions;
  - rejecting a whole statement whose wording, rather than its facts, is wrong. Its facts can be
    rejected instead.
