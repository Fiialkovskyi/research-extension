import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, SESSION_STORE } from "@/shared/storage";

/**
 * Keeps a session apart from the saved session it was offered to continue:
 * the offer is withdrawn and not made again.
 *
 * @returns Whether the session existed.
 */
export const declineReattach = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
): Promise<boolean> => {
  const transaction = database.transaction(SESSION_STORE, "readwrite");
  const session = await transaction.store.get(sessionId);

  if (session === undefined) {
    await transaction.done;
    return false;
  }

  const { reattachSuggestion: _suggestion, ...rest } = session;

  await transaction.store.put({ ...rest, reattachDeclined: true });
  await transaction.done;

  return true;
};
