/** The chunker that cut a snapshot's text; part of every embedding space. */
export const CHUNKER_VERSION = "chunker@1";

/** About how many words a chunk holds (target spec §8). */
export const CHUNK_TARGET_WORDS = 220;

/** The job type that embeds one snapshot. */
export const EMBED_SNAPSHOT_JOB = "embedSnapshot";

/** How many parts are embedded per call, and between checkpoints (REQ-MOD-008: one batch at a time). */
export const EMBEDDING_BATCH_SIZE = 8;

/**
 * Tokens per word for the estimate a chunk is fitted by. Errs high for English
 * subword tokenisers, so a part rarely exceeds a model's limit.
 */
export const TOKENS_PER_WORD = 1.4;

/** Tokens a model adds around every input, such as `[CLS]` and `[SEP]`. */
export const SPECIAL_TOKENS = 2;
