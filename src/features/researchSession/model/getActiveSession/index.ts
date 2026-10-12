import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, SESSION_STORE, type StoredSession } from "@/shared/storage";

/**
 * Reads the active session, or `undefined` when none is.
 *
 * Reads the record as stored and does not ask the browser whether its group
 * still exists; {@link reconcileActiveSession} does that.
 */
export const getActiveSession = (
  database: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<StoredSession | undefined> => {
  return database.getFromIndex(SESSION_STORE, "status", "active");
};
