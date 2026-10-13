import type { IDBPDatabase } from "idb";

import { JOB_STORE, type ResearchDatabaseSchema, type StoredJob } from "@/shared/storage";

/**
 * Hands out the highest-priority queued job that is due, marking it running.
 *
 * The search and the status change share one `readwrite` transaction, so two
 * claims made together are serialised and cannot both take the same job.
 *
 * A job `isPermitted` rejects is passed over, not waited for: the next one in
 * priority order is claimed instead, so a job that may not run now (text
 * generation while the user is active) never holds up the rest.
 *
 * @returns The claimed job, or `undefined` when nothing is due.
 */
export const claimNextJob = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  now: number = Date.now(),
  isPermitted: (job: StoredJob) => boolean = () => true,
): Promise<StoredJob | undefined> => {
  const transaction = database.transaction(JOB_STORE, "readwrite");
  const queued = IDBKeyRange.bound(["queued", -Infinity], ["queued", Infinity]);
  let cursor = await transaction.store.index("statusPriority").openCursor(queued, "prev");

  while (cursor !== null && (cursor.value.nextAttemptAt > now || !isPermitted(cursor.value))) {
    cursor = await cursor.continue();
  }

  if (cursor === null) {
    await transaction.done;
    return undefined;
  }

  const claimed: StoredJob = { ...cursor.value, status: "running", updatedAt: now };

  await cursor.update(claimed);
  await transaction.done;

  return claimed;
};
