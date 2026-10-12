import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, SESSION_STORE } from "@/shared/storage";

/**
 * Gives a session its embedding space (REQ-LIN-002), unless it already has
 * one: the space of a session's first vectors is the one its similarity work
 * uses until a model swap moves it.
 *
 * @returns The session's space after the call, or `undefined` without such a session.
 */
export const claimSessionEmbeddingSpace = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  spaceId: string,
): Promise<string | undefined> => {
  const transaction = database.transaction(SESSION_STORE, "readwrite");
  const session = await transaction.store.get(sessionId);

  if (session === undefined) {
    await transaction.done;
    return undefined;
  }

  if (session.activeEmbeddingSpaceId === undefined) {
    await transaction.store.put({ ...session, activeEmbeddingSpaceId: spaceId });
  }

  await transaction.done;

  return session.activeEmbeddingSpaceId ?? spaceId;
};
