import type { IDBPDatabase } from "idb";

import { getErrorMessage } from "@/shared/getErrorMessage";
import type { ResearchDatabaseSchema, StoredJob } from "@/shared/storage";

import { claimNextJob } from "../claimNextJob";
import { completeJob } from "../completeJob";
import { failJob } from "../failJob";

/** Runs one claimed job of its type; a throw fails the attempt. */
export type JobRunner = (job: StoredJob) => Promise<void>;

/**
 * Claims the next due job and runs it with the runner for its type, marking it
 * done or failed (with the queue's backoff). A job of a type with no runner is
 * failed rather than left claimed forever.
 *
 * @returns Whether a job was claimed, so a runner knows to try for another.
 */
export const runNextJob = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  runners: Readonly<Record<string, JobRunner>>,
): Promise<boolean> => {
  const job = await claimNextJob(database);

  if (job === undefined) {
    return false;
  }

  try {
    const run = runners[job.type];

    if (run === undefined) {
      throw new Error(`No runner for jobs of type "${job.type}".`);
    }

    await run(job);
    await completeJob(database, job.id);
  } catch (error) {
    await failJob(database, job.id, getErrorMessage(error));
  }

  return true;
};
