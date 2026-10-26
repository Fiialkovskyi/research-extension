import type { IDBPDatabase } from "idb";

import type { ResearchDatabaseSchema, StoredSession } from "@/shared/storage";

import { listLiveSessions } from "../listLiveSessions";

/**
 * Finds the live session a tab group belongs to: the one that follows it, or
 * whose `formerGroupIds` hold it (a group restored after the session moved on).
 * A group belongs to at most one session; `undefined` when it is in none.
 */
export const getSessionForGroup = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  groupId: number,
): Promise<StoredSession | undefined> => {
  const live = await listLiveSessions(database);

  return (
    live.find((session) => session.groupId === groupId) ??
    live.find((session) => session.formerGroupIds.includes(groupId))
  );
};
