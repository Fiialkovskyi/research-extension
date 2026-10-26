import type { IDBPDatabase } from "idb";

import { JOB_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

/**
 * Records on each job that the user asked for it, so it may run while they are
 * active. The mark lives in the job's payload, so it outlives an unload of the
 * background. A job that no longer exists is skipped.
 */
export const markJobsRequested = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  jobIds: readonly string[],
  requestedAt: number,
): Promise<void> => {
  const transaction = database.transaction(JOB_STORE, "readwrite");

  await Promise.all([
    ...jobIds.map(async (id) => {
      const stored = await transaction.store.get(id);

      if (stored !== undefined) {
        await transaction.store.put({
          ...stored,
          payload: { ...(stored.payload as object), requestedAt },
        });
      }
    }),
    transaction.done,
  ]);
};
