import type { IDBPDatabase } from "idb";

import { JOB_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

import { LOCAL_SERVER_FAILURE_PATTERN } from "../../constants";

/**
 * Hands back every job that stopped only because Ollama was not answering —
 * queued for a later retry, or out of retries — with its attempts reset, due
 * now. Called once Ollama answers again, so the time it was away costs no job
 * its retries.
 *
 * @returns How many jobs were handed back.
 */
export const requeuePausedJobs = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  now: number,
): Promise<number> => {
  const transaction = database.transaction(JOB_STORE, "readwrite");
  const paused = (await transaction.store.getAll()).filter(
    ({ status, failureReason }) =>
      (status === "queued" || status === "failed") &&
      failureReason !== undefined &&
      LOCAL_SERVER_FAILURE_PATTERN.test(failureReason),
  );

  await Promise.all(
    paused.map(({ failureReason: _reason, ...job }) =>
      transaction.store.put({
        ...job,
        status: "queued",
        attempts: 0,
        nextAttemptAt: now,
        updatedAt: now,
      }),
    ),
  );
  await transaction.done;

  return paused.length;
};
