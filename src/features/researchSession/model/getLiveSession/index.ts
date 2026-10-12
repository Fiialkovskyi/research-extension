import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, SESSION_STORE, type StoredSession } from "@/shared/storage";

/**
 * Reads the session that is still going on: the active one, or else the closed
 * one whose group may come back. `undefined` when there is neither.
 *
 * Until after the MVP there is at most one such session, because starting a
 * session ends a closed one.
 */
export const getLiveSession = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<StoredSession | undefined> => {
  return (
    (await database.getFromIndex(SESSION_STORE, "status", "active")) ??
    database.getFromIndex(SESSION_STORE, "status", "closed")
  );
};
