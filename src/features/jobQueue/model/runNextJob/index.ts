import type { IDBPDatabase } from "idb";

import { getErrorMessage } from "@/shared/getErrorMessage";
import type { ResearchDatabaseSchema, StoredJob } from "@/shared/storage";

import { claimNextJob } from "../claimNextJob";
import { completeJob } from "../completeJob";
import { deferJob } from "../deferJob";
import { failJob } from "../failJob";

/**
 * Runs one claimed job of its type; a throw fails the attempt. Returning
 * `"deferred"` hands the job back unfinished — its checkpoint kept, no attempt
 * counted — for a job that found it may not go on now.
 */
export type JobRunner = (job: StoredJob) => Promise<void | "deferred">;

export interface RunNextJobOptions {
  /** Whether a queued job may be claimed now; every job may by default. */
  isPermitted?: (job: StoredJob) => boolean;
}

/**
 * Claims the next due job that is permitted and runs it with the runner for its
 * type, marking it done, deferred or failed (with the queue's backoff). A job of a type with no runner is
 * failed rather than left claimed forever.
 *
 * @returns Whether a job was claimed, so a runner knows to try for another.
 */
export const runNextJob = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  runners: Readonly<Record<string, JobRunner>>,
  { isPermitted }: RunNextJobOptions = {},
): Promise<boolean> => {
  const job = await claimNextJob(database, Date.now(), isPermitted);

  if (job === undefined) {
    return false;
  }

  try {
    const run = runners[job.type];

    if (run === undefined) {
      throw new Error(`No runner for jobs of type "${job.type}".`);
    }

    if ((await run(job)) === "deferred") {
      await deferJob(database, job.id);
    } else {
      await completeJob(database, job.id);
    }
  } catch (error) {
    await failJob(database, job.id, getErrorMessage(error));
  }

  return true;
};
