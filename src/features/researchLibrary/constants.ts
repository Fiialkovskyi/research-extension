/**
 * How long saving waits for each open page to send what it holds. A page that
 * does not answer by then — no observer, or a slow one — is not waited for.
 */
export const SAVE_FLUSH_TIMEOUT_MS = 1_000;

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
