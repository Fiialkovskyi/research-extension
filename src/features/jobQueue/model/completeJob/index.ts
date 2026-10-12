import type { IDBPDatabase } from "idb";

import { JOB_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

/**
 * Marks a job done and drops its checkpoint, which nothing will resume from.
 * A done job stays in the store, so the same work asked for again is skipped.
 *
 * @throws If no job has that id.
 */
export const completeJob = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  jobId: string,
): Promise<void> => {
  const transaction = database.transaction(JOB_STORE, "readwrite");
  const job = await transaction.store.get(jobId);

  if (job === undefined) {
    throw new Error(`No job is queued under "${jobId}".`);
  }

  const { checkpoint: _finished, ...done } = job;

  await transaction.store.put({ ...done, status: "done", updatedAt: Date.now() });
  await transaction.done;
};
