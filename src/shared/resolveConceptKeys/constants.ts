/**
 * How similar two concepts' embeddings must be for their columns to merge.
 * Measured with `nomic-embed-text` on English labels: pairs that mean one thing
 * (`colour`/`color` 0.97, `price`/`cost` 0.91, `battery capacity`/`battery size`
 * 0.90) sit among pairs that do not (`screen size`/`screen resolution` 0.89,
 * `processor`/`processor speed` 0.87, `battery life`/`battery capacity` 0.85),
 * and `weight`/`mass` (0.75) falls below both. No threshold separates them all,
 * so this one is above every pair that must stay apart: it merges only near
 * synonyms, and a column that could have merged stays two — never the reverse.
 */
export const CONCEPT_SIMILARITY_THRESHOLD = 0.9;

/** Labels embedded per request. */
export const CONCEPT_EMBEDDING_BATCH_SIZE = 64;
