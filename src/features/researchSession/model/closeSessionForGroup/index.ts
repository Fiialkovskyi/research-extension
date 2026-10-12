import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, SESSION_STORE, type StoredSession } from "@/shared/storage";

/**
 * Closes the active session if it follows the given group.
 *
 * Called when the group is removed. The session is suspended, not ended:
 * Firefox removes a group the same way whether the user deleted it, saved it,
 * closed its window or closed its last tab, and several of those paths bring it
 * back under the same id. A group that is not the active session's is ignored,
 * so every group removal can be passed here.
 *
 * @returns The closed session, or `undefined` when the group was not the session's.
 */
export const closeSessionForGroup = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  groupId: number,
): Promise<StoredSession | undefined> => {
  const transaction = database.transaction(SESSION_STORE, "readwrite");
  const active = await transaction.store.index("status").get("active");

  if (active === undefined || active.groupId !== groupId) {
    await transaction.done;
    return undefined;
  }

  const closed: StoredSession = { ...active, status: "closed", updatedAt: Date.now() };

  await transaction.store.put(closed);
  await transaction.done;

  return closed;
};
