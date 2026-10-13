import type { IDBPDatabase } from "idb";

import {
  CHUNK_STORE,
  CLUSTERING_STORE,
  EDGE_STORE,
  ENTITY_STORE,
  EXTRACTION_STORE,
  FACT_STORE,
  JOB_STORE,
  NODE_STORE,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  SNAPSHOT_STORE,
  SUMMARY_STORE,
  TABLE_COLUMNS_STORE,
  VECTOR_STORE,
} from "@/shared/storage";

/** The stores that hold a session's records, each indexed by `sessionId`. */
const SESSION_SCOPED_STORES = [
  NODE_STORE,
  EDGE_STORE,
  SNAPSHOT_STORE,
  CHUNK_STORE,
  VECTOR_STORE,
  FACT_STORE,
  EXTRACTION_STORE,
  ENTITY_STORE,
  SUMMARY_STORE,
  TABLE_COLUMNS_STORE,
  JOB_STORE,
] as const;

/**
 * Deletes a session and everything recorded for it, in one transaction
 * (REQ-STO-008): every record carrying its id in every session-scoped store,
 * its clustering, then the session itself. Embedding spaces stay: they are
 * shared definitions, not the session's data.
 *
 * @returns Whether the session existed.
 */
export const deleteSession = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
): Promise<boolean> => {
  const transaction = database.transaction(
    [...SESSION_SCOPED_STORES, CLUSTERING_STORE, SESSION_STORE] as const,
    "readwrite",
  );
  const sessions = transaction.objectStore(SESSION_STORE);

  if ((await sessions.get(sessionId)) === undefined) {
    await transaction.done;
    return false;
  }

  const deletions = await Promise.all(
    SESSION_SCOPED_STORES.map(async (name) => {
      const store = transaction.objectStore(name);
      const keys = await store.index("sessionId").getAllKeys(sessionId);

      return keys.map((key) => store.delete(key as never));
    }),
  );

  await Promise.all([
    ...deletions.flat(),
    transaction.objectStore(CLUSTERING_STORE).delete(sessionId),
    sessions.delete(sessionId),
    transaction.done,
  ]);

  return true;
};
