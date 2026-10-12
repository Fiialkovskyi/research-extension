import type { IDBPDatabase } from "idb";

import { JOB_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

/**
 * Records a running job's progress, so an interrupted run resumes from here.
 *
 * @throws If the job is not running: a checkpoint for a job that was requeued
 *   or finished meanwhile belongs to a run that no longer owns it.
 */
export const checkpointJob = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  jobId: string,
  checkpoint: unknown,
): Promise<void> => {
  const transaction = database.transaction(JOB_STORE, "readwrite");
  const job = await transaction.store.get(jobId);

  if (job?.status !== "running") {
    throw new Error(`Job "${jobId}" is not running, so it cannot record a checkpoint.`);
  }

  await transaction.store.put({ ...job, checkpoint, updatedAt: Date.now() });
  await transaction.done;
};
