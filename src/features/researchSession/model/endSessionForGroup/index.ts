import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, SESSION_STORE, type StoredSession } from "@/shared/storage";

/**
 * Ends the active session if it follows the given group, keeping it as `saved`.
 *
 * Called when the group is gone. The session is kept, not deleted: what was
 * researched stays available after its tabs are closed. A group that is not
 * the active session's is ignored, so every group removal can be passed here.
 *
 * @returns The ended session, or `undefined` when the group was not the session's.
 */
export const endSessionForGroup = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  groupId: number,
): Promise<StoredSession | undefined> => {
  const transaction = database.transaction(SESSION_STORE, "readwrite");
  const active = await transaction.store.index("status").get("active");

  if (active === undefined || active.groupId !== groupId) {
    await transaction.done;
    return undefined;
  }

  const ended: StoredSession = { ...active, status: "saved", updatedAt: Date.now() };

  await transaction.store.put(ended);
  await transaction.done;

  return ended;
};
