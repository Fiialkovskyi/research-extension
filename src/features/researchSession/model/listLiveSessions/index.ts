import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, SESSION_STORE, type StoredSession } from "@/shared/storage";

/**
 * Reads every session that is still going on: the active ones, then the closed
 * ones whose group may come back. Several may exist at once.
 *
 * Reads the records as stored and does not ask the browser whether their
 * groups still exist; {@link reconcileSessions} does that.
 */
export const listLiveSessions = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<StoredSession[]> => {
  const [active, closed] = await Promise.all([
    database.getAllFromIndex(SESSION_STORE, "status", "active"),
    database.getAllFromIndex(SESSION_STORE, "status", "closed"),
  ]);

  return [...active, ...closed];
};
