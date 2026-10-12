import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, SESSION_STORE, type StoredSession } from "@/shared/storage";

/**
 * Makes the closed session active again when its group is back.
 *
 * A restored group keeps its id on every path that restores it — undoing a
 * deletion, reopening a saved group, a window's group coming back — so the id
 * alone identifies the session. A group that is not the closed session's is
 * ignored, so every group creation can be passed here.
 *
 * @returns The reopened session, or `undefined` when the group was not the session's.
 */
export const reopenSessionForGroup = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  groupId: number,
): Promise<StoredSession | undefined> => {
  const transaction = database.transaction(SESSION_STORE, "readwrite");
  const closed = await transaction.store.index("status").get("closed");

  if (closed === undefined || closed.groupId !== groupId) {
    await transaction.done;
    return undefined;
  }

  const reopened: StoredSession = { ...closed, status: "active", updatedAt: Date.now() };

  await transaction.store.put(reopened);
  await transaction.done;

  return reopened;
};
