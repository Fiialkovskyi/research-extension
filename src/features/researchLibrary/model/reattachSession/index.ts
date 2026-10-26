import type { IDBPDatabase } from "idb";

import {
  ACTIVITY_STORE,
  CHUNK_STORE,
  CLUSTERING_STORE,
  EDGE_STORE,
  JOB_STORE,
  NODE_STORE,
  PAGE_METADATA_STORE,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  SNAPSHOT_STORE,
  type StoredSession,
  VECTOR_STORE,
} from "@/shared/storage";

/** The stores whose records carry their session's id, each indexed by it. */
const SESSION_SCOPED_STORES = [
  NODE_STORE,
  EDGE_STORE,
  SNAPSHOT_STORE,
  CHUNK_STORE,
  VECTOR_STORE,
  JOB_STORE,
  ACTIVITY_STORE,
  PAGE_METADATA_STORE,
] as const;

export interface ReattachSessionOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  activeSessionId: string;
  savedSessionId: string;
  now: number;
}

/**
 * Continues a saved session in the place of the session just started
 * (REQ-STO-006), in one transaction: every record of the new session becomes
 * the saved one's, the saved session becomes active on the current tab group,
 * and the new session and its clustering are removed. The saved session's
 * earlier pages stay in its record; its earlier tabs are not reopened.
 *
 * @returns The continued session.
 * @throws When the new session is not active or the other is not saved.
 */
export const reattachSession = async ({
  database,
  activeSessionId,
  savedSessionId,
  now,
}: ReattachSessionOptions): Promise<StoredSession> => {
  const transaction = database.transaction(
    [...SESSION_SCOPED_STORES, CLUSTERING_STORE, SESSION_STORE] as const,
    "readwrite",
  );
  const sessions = transaction.objectStore(SESSION_STORE);
  const [active, saved] = await Promise.all([
    sessions.get(activeSessionId),
    sessions.get(savedSessionId),
  ]);

  if (active?.status !== "active" || (saved?.status !== "saved" && saved?.status !== "closed")) {
    transaction.abort();
    await transaction.done.catch(() => undefined);
    throw new Error("Only a saved session can be continued from the active one.");
  }

  const moves = await Promise.all(
    SESSION_SCOPED_STORES.map(async (name) => {
      const store = transaction.objectStore(name);
      const records = await store.index("sessionId").getAll(activeSessionId);

      return records.map((record) => store.put({ ...record, sessionId: savedSessionId } as never));
    }),
  );
  const {
    lastPosition: _lastPosition,
    reattachSuggestion: _suggestion,
    savedTabs: _savedTabs,
    focus: _focus,
    recentSwitches: _switches,
    ...earlier
  } = saved;
  const continued: StoredSession = {
    ...earlier,
    status: "active",
    groupId: active.groupId,
    formerGroupIds: [...saved.formerGroupIds, saved.groupId],
    ...(active.focus === undefined ? {} : { focus: active.focus }),
    ...(active.recentSwitches === undefined ? {} : { recentSwitches: active.recentSwitches }),
    updatedAt: now,
  };

  await Promise.all([
    ...moves.flat(),
    transaction.objectStore(CLUSTERING_STORE).delete(activeSessionId),
    sessions.delete(activeSessionId),
    sessions.put(continued),
    transaction.done,
  ]);

  return continued;
};
