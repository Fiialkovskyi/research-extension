import type { IDBPDatabase } from "idb";

import {
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredFocusVisit,
} from "@/shared/storage";

/**
 * Records the visit the user is on now on the active session.
 *
 * Written only while that session is still the active one: a session closed
 * between reading it and writing here keeps the visit it had.
 *
 * @returns Whether the visit was written.
 */
export const setSessionFocus = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  focus: StoredFocusVisit,
): Promise<boolean> => {
  const transaction = database.transaction(SESSION_STORE, "readwrite");
  const session = await transaction.store.get(sessionId);

  if (session?.status !== "active") {
    await transaction.done;
    return false;
  }

  await transaction.store.put({ ...session, focus });
  await transaction.done;

  return true;
};
