/**
 * How long capture must be quiet before the session's tabs are recorded.
 * Closing a group removes its tabs one by one and then the group, all well
 * within this, so no record is taken from a half-closed group.
 */
export const TAB_RECORD_DELAY_MS = 1_000;

/** The longest a record of the tabs waits for capture to go quiet. */
export const TAB_RECORD_MAX_WAIT_MS = 5_000;

/** A saved session matches by terms when this share of all terms is shared (Jaccard). */
export const REATTACH_TERM_OVERLAP = 0.6;

/** A saved session matches by meaning when the queries' embeddings are this similar. */
export const REATTACH_SIMILARITY = 0.8;

/** Words too common to say what a search is about. */
export const QUERY_STOP_WORDS: ReadonlySet<string> = new Set([
  "the",
  "a",
  "an",
  "of",
  "for",
  "and",
  "or",
  "in",
  "on",
  "to",
  "with",
  "vs",
  "how",
  "what",
  "best",
]);
