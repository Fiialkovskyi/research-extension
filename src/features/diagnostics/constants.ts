/**
 * How a background-lifetime probe run tries to keep the event page alive
 * (spike M0-1):
 *
 * - `none`: awaits only — the control, expected to be unloaded.
 * - `apiActivity`: a cheap read-only `browser.*` call every few seconds.
 * - `wakeAndResume`: no keep-alive; an alarm wakes the unloaded page and the
 *   run resumes from its checkpoint.
 * - `hostPage`: an extension page holds a port the background posts to.
 * - `jobRunner`: the hold every background job runs under — the strategy the
 *   spike chose, exercised through the runner's own code.
 */
export const LIFETIME_STRATEGIES = [
  "none",
  "apiActivity",
  "wakeAndResume",
  "hostPage",
  "jobRunner",
] as const;

/** How often a probe run writes a heartbeat. */
export const PROBE_HEARTBEAT_INTERVAL_MS = 2_000;

/**
 * How long past the beat interval a run may stay silent before it counts as
 * stopped rather than still running: one missed beat is a busy page, two are
 * a dead one.
 */
export const PROBE_SILENCE_LIMIT_MS = PROBE_HEARTBEAT_INTERVAL_MS * 2;

/** The job type a probe run is queued as. */
export const LIFETIME_PROBE_JOB = "diagnostics.lifetimeProbe";

/**
 * The `hostPage` strategy's page: an extension page that only connects a port
 * under {@link HOLD_PORT_NAME}, for the background to post to.
 */
export const HOLD_PAGE_PATH = "/hold.html";
export const HOLD_PORT_NAME = "hold";

/** How often the background posts to the hold page's port while holding. */
export const HOLD_PING_INTERVAL_MS = 2_000;
