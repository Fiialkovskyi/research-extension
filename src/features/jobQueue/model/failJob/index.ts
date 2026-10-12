import type { IDBPDatabase } from "idb";

import { JOB_STORE, type ResearchDatabaseSchema, type StoredJob } from "@/shared/storage";

import { JOB_RETRY_BASE_DELAY_MS, JOB_RETRY_LIMIT } from "../../constants";

/**
 * Counts a failed attempt and decides what happens next.
 *
 * Up to {@link JOB_RETRY_LIMIT} retries, the job goes back to the queue after a
 * delay that doubles each time (30 s, 60 s, 120 s), keeping its checkpoint so
 * the retry resumes. After that it stays `failed` with the reason, where a
 * surface can show it instead of the work silently never finishing.
 *
 * @throws If no job has that id.
 */
export const failJob = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  jobId: string,
  reason: string,
  now: number = Date.now(),
): Promise<StoredJob> => {
  const transaction = database.transaction(JOB_STORE, "readwrite");
  const job = await transaction.store.get(jobId);

  if (job === undefined) {
    throw new Error(`No job is queued under "${jobId}".`);
  }

  const attempts = job.attempts + 1;
  const failed: StoredJob =
    attempts <= JOB_RETRY_LIMIT
      ? {
          ...job,
          status: "queued",
          attempts,
          nextAttemptAt: now + JOB_RETRY_BASE_DELAY_MS * 2 ** (attempts - 1),
          failureReason: reason,
          updatedAt: now,
        }
      : { ...job, status: "failed", attempts, failureReason: reason, updatedAt: now };

  await transaction.store.put(failed);
  await transaction.done;

  return failed;
};
