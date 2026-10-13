import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, SESSION_STORE } from "@/shared/storage";

/**
 * Offers the active session a saved session to continue, unless it is no
 * longer active or the question was already put or answered: the offer is
 * made once.
 *
 * @returns Whether the offer was recorded.
 */
export const suggestReattach = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  suggestion: { sessionId: string; title: string },
): Promise<boolean> => {
  const transaction = database.transaction(SESSION_STORE, "readwrite");
  const session = await transaction.store.get(sessionId);

  if (
    session?.status !== "active" ||
    session.reattachSuggestion !== undefined ||
    session.reattachDeclined === true
  ) {
    await transaction.done;
    return false;
  }

  await transaction.store.put({ ...session, reattachSuggestion: suggestion });
  await transaction.done;

  return true;
};
