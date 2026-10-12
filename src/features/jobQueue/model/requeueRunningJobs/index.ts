import type { IDBPDatabase } from "idb";

import { JOB_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

/**
 * Puts jobs left `running` back in the queue, due now.
 *
 * Called when the background wakes. A job still running then was interrupted —
 * the page was unloaded under it — not failed, so no attempt is counted and its
 * checkpoint is kept for the next run to resume from (REQ-RT-005).
 *
 * @returns How many jobs were requeued.
 */
export const requeueRunningJobs = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  now: number = Date.now(),
): Promise<number> => {
  const transaction = database.transaction(JOB_STORE, "readwrite");
  const running = IDBKeyRange.bound(["running", -Infinity], ["running", Infinity]);
  let cursor = await transaction.store.index("statusPriority").openCursor(running);
  let requeued = 0;

  while (cursor !== null) {
    await cursor.update({ ...cursor.value, status: "queued", nextAttemptAt: now, updatedAt: now });
    requeued += 1;
    cursor = await cursor.continue();
  }

  await transaction.done;

  return requeued;
};
