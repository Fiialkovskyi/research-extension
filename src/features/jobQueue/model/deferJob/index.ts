import type { IDBPDatabase } from "idb";

import { JOB_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

/**
 * Hands a running job back to the queue unfinished, due now: it found it may
 * not go on yet, which is not a failure, so no attempt is counted and its
 * checkpoint is kept for the run that picks it up again.
 *
 * @throws If no job has that id.
 */
export const deferJob = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  jobId: string,
  now: number = Date.now(),
): Promise<void> => {
  const transaction = database.transaction(JOB_STORE, "readwrite");
  const job = await transaction.store.get(jobId);

  if (job === undefined) {
    throw new Error(`No job is queued under "${jobId}".`);
  }

  await transaction.store.put({ ...job, status: "queued", nextAttemptAt: now, updatedAt: now });
  await transaction.done;
};
