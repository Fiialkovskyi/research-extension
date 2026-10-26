/**
 * The durable job queue: background work that survives the event page being
 * unloaded, is never done twice for the same inputs, and gives up visibly.
 *
 * A job is identified by what it does (type, inputs, producer version), claimed
 * by priority, checkpointed while it runs, retried with backoff, and put back
 * in the queue when the page that ran it was unloaded. It also hands a job to
 * the runner for its type, holds the background alive while one runs, and says
 * when the background should next wake itself; what each type does is its
 * feature's business.
 */

export {
  JOB_RETRY_BASE_DELAY_MS,
  JOB_RETRY_LIMIT,
  JOB_WAKE_ALARM,
  JOB_WAKE_DELAY_MS,
  KEEP_ALIVE_INTERVAL_MS,
} from "./constants";
export type { JobIdentity, NewJob } from "./types";
export { buildJobId } from "./model/buildJobId";
export { checkpointJob } from "./model/checkpointJob";
export { claimNextJob } from "./model/claimNextJob";
export { completeJob } from "./model/completeJob";
export { deferJob } from "./model/deferJob";
export { enqueueJob } from "./model/enqueueJob";
export { failJob } from "./model/failJob";
export { getNextWakeTime } from "./model/getNextWakeTime";
export { holdBackgroundAlive, type ReleaseHold } from "./model/holdBackgroundAlive";
export { markJobsRequested } from "./model/markJobsRequested";
export { readJobActivity } from "./model/readJobActivity";
export type {
  JobActivity,
  JobBatch,
  QueuedWork,
  ReadJobActivityOptions,
  RunningWork,
} from "./model/readJobActivity/types";
export { readPendingJobs } from "./model/readPendingJobs";
export { requeueRunningJobs } from "./model/requeueRunningJobs";
export { type JobRunner, runNextJob, type RunNextJobOptions } from "./model/runNextJob";
