import type { StoredJob } from "@/shared/storage";

import { JOB_WAKE_DELAY_MS } from "../../constants";

/**
 * When the background should next wake itself to run jobs.
 *
 * - While a job is running: one {@link JOB_WAKE_DELAY_MS} from now. If the page
 *   is unloaded under it, the wake-up finds it, requeues it and resumes it.
 * - Otherwise, while jobs are queued: when the earliest of them is due, but no
 *   sooner than one {@link JOB_WAKE_DELAY_MS} from now.
 * - Otherwise: never. A failed or done job does not keep the browser waking.
 *
 * @returns The time to wake at, or `undefined` for no wake-up.
 */
export const getNextWakeTime = (jobs: readonly StoredJob[], now: number): number | undefined => {
  const soonest = now + JOB_WAKE_DELAY_MS;

  if (jobs.some(({ status }) => status === "running")) {
    return soonest;
  }

  const due = jobs
    .filter(({ status }) => status === "queued")
    .map(({ nextAttemptAt }) => nextAttemptAt);

  return due.length === 0 ? undefined : Math.max(soonest, Math.min(...due));
};
