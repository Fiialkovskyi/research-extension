import type { IDBPDatabase } from "idb";

import { NODE_STORE, type ResearchDatabaseSchema, SESSION_STORE } from "@/shared/storage";

import type { SavedSessionSummary } from "../../types";

/**
 * The saved sessions, newest first, with what the library shows of each. A
 * closed session — its group gone, and possibly coming back — is saved too:
 * it was kept as the user went, so it is listed and can be resumed.
 */
export const listSavedSessions = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<SavedSessionSummary[]> => {
  const saved = [
    ...(await database.getAllFromIndex(SESSION_STORE, "status", "saved")),
    ...(await database.getAllFromIndex(SESSION_STORE, "status", "closed")),
  ];
  const summaries = await Promise.all(
    saved.map(async (session) => ({
      id: session.id,
      title: session.title,
      savedAt: session.savedAt ?? session.updatedAt,
      pageCount: await database.countFromIndex(NODE_STORE, "sessionId", session.id),
      lastPosition:
        session.lastPosition === undefined
          ? null
          : { title: session.lastPosition.title, readFraction: session.lastPosition.readFraction },
    })),
  );

  return summaries.toSorted((first, second) => second.savedAt - first.savedAt);
};
