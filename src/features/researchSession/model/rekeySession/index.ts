import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, SESSION_STORE, type StoredSession } from "@/shared/storage";

/**
 * Moves a live session onto another tab group, and makes it active.
 *
 * Used when a session tab comes back after the session's group is gone for
 * good: the tab gets a group of its own, under a new id, and the session
 * follows it. The id it leaves is kept in `formerGroupIds`, so that if that
 * group is restored after all, its tabs are recognised and merged in.
 *
 * @returns The session as recorded, or `undefined` when it is no longer live.
 */
export const rekeySession = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  groupId: number,
): Promise<StoredSession | undefined> => {
  const transaction = database.transaction(SESSION_STORE, "readwrite");
  const session = await transaction.store.get(sessionId);

  if (session === undefined || session.status === "saved") {
    await transaction.done;
    return undefined;
  }

  const formerGroupIds =
    session.groupId === groupId
      ? session.formerGroupIds
      : [...session.formerGroupIds.filter((id) => id !== groupId), session.groupId];
  const rekeyed: StoredSession = {
    ...session,
    groupId,
    formerGroupIds,
    status: "active",
    updatedAt: Date.now(),
  };

  await transaction.store.put(rekeyed);
  await transaction.done;

  return rekeyed;
};
