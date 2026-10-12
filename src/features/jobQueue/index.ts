/**
 * The durable job queue: background work that survives the event page being
 * unloaded, is never done twice for the same inputs, and gives up visibly.
 *
 * A job is identified by what it does (type, inputs, producer version), claimed
 * by priority, checkpointed while it runs, retried with backoff, and put back
 * in the queue when the page that ran it was unloaded. Running jobs is the
 * runner's business; this module only keeps the queue.
 */

export { JOB_RETRY_BASE_DELAY_MS, JOB_RETRY_LIMIT } from "./constants";
export type { JobIdentity, NewJob } from "./types";
export { buildJobId } from "./model/buildJobId";
export { checkpointJob } from "./model/checkpointJob";
export { claimNextJob } from "./model/claimNextJob";
export { completeJob } from "./model/completeJob";
export { enqueueJob } from "./model/enqueueJob";
export { failJob } from "./model/failJob";
export { requeueRunningJobs } from "./model/requeueRunningJobs";
