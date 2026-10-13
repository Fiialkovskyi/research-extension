import type { IDBPDatabase } from "idb";

import { JOB_STORE, type ResearchDatabaseSchema, type StoredJob } from "@/shared/storage";

/**
 * Reads the jobs that still have work ahead of them: queued or running. Done
 * and failed jobs, which accumulate, are not read.
 */
export const readPendingJobs = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<StoredJob[]> => {
  const byStatus = (status: "queued" | "running") =>
    database.getAllFromIndex(
      JOB_STORE,
      "statusPriority",
      IDBKeyRange.bound([status, -Infinity], [status, Infinity]),
    );
  const [queued, running] = await Promise.all([byStatus("queued"), byStatus("running")]);

  return [...running, ...queued];
};
