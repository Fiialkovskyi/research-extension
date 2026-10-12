import type { IDBPDatabase } from "idb";

import { claimNextJob, completeJob, failJob } from "@/features/jobQueue";
import { getErrorMessage } from "@/shared/getErrorMessage";
import type { ResearchDatabaseSchema } from "@/shared/storage";

import { EMBED_SNAPSHOT_JOB } from "../../constants";
import { type RunEmbeddingJobOptions, runEmbeddingJob } from "../runEmbeddingJob";

/**
 * Claims the next due job and runs it, marking it done or failed (with the
 * queue's backoff). Embedding is the only job type so far; a job of another
 * type is failed rather than left claimed forever.
 *
 * @returns Whether a job was claimed, so a runner knows to try for another.
 */
export const runNextEmbeddingJob = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  loadSession: RunEmbeddingJobOptions["loadSession"],
): Promise<boolean> => {
  const job = await claimNextJob(database);

  if (job === undefined) {
    return false;
  }

  try {
    if (job.type !== EMBED_SNAPSHOT_JOB) {
      throw new Error(`No runner for jobs of type "${job.type}".`);
    }

    await runEmbeddingJob({ database, job, loadSession });
    await completeJob(database, job.id);
  } catch (error) {
    await failJob(database, job.id, getErrorMessage(error));
  }

  return true;
};
