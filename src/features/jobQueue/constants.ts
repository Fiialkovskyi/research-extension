/** How many times a failed job is retried before it stays failed (REQ-STO-010). */
export const JOB_RETRY_LIMIT = 3;

/** Delay before the first retry; each further retry waits twice as long. */
export const JOB_RETRY_BASE_DELAY_MS = 30_000;
