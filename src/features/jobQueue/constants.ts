/** How many times a failed job is retried before it stays failed (REQ-STO-010). */
export const JOB_RETRY_LIMIT = 3;

/** Delay before the first retry; each further retry waits twice as long. */
export const JOB_RETRY_BASE_DELAY_MS = 30_000;

/**
 * How often a held background touches the browser API to count as active.
 * Firefox unloads an idle MV3 event page after 30 s by default; a sixth of
 * that leaves room for a slow call, and lets the e2e shorten the timeout to a
 * few seconds and still exercise the real interval.
 */
export const KEEP_ALIVE_INTERVAL_MS = 5_000;

/**
 * The soonest a scheduled wake-up fires, and how far ahead one is set while a
 * job runs. Browsers may hold shorter alarms back; one minute is honoured.
 */
export const JOB_WAKE_DELAY_MS = 60_000;

/** The one alarm that wakes the background to run jobs. */
export const JOB_WAKE_ALARM = "jobs.wake";
