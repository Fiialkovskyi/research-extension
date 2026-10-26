import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, SESSION_STORE, type StoredSession } from "@/shared/storage";

/**
 * Makes an active session the one the popup refers to, and the pages opened
 * from it. Nothing else changes: no session is started, resumed, closed or
 * ended, and every live session keeps being recorded.
 *
 * The choice is kept on the session itself, so it outlives the popup and the
 * background page, and goes with the session when it is deleted.
 *
 * @returns The session, or `undefined` when it is not an active one.
 */
export const viewSession = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  now: number,
): Promise<StoredSession | undefined> => {
  const transaction = database.transaction(SESSION_STORE, "readwrite");
  const session = await transaction.store.get(sessionId);

  if (session?.status !== "active") {
    await transaction.done;
    return undefined;
  }

  const viewed: StoredSession = { ...session, viewedAt: now };

  await transaction.store.put(viewed);
  await transaction.done;

  return viewed;
};
