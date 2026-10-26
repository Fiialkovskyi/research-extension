import type { IDBPDatabase } from "idb";

import {
  NODE_STORE,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredSession,
} from "@/shared/storage";

import { findLastPosition } from "./utils/findLastPosition";

/**
 * Closes the active session that follows the given group, leaving any other
 * session as it is.
 *
 * Called when the group is removed. The session is suspended, not ended:
 * Firefox removes a group the same way whether the user deleted it, saved it,
 * closed its window or closed its last tab, and several of those paths bring it
 * back under the same id. A group that is no active session's is ignored,
 * so every group removal can be passed here.
 *
 * Closing is also when the session is saved: its tabs were recorded while it
 * was active, and the page the user was on is recorded here, so the library can
 * resume it where the user left off.
 *
 * @returns The closed session, or `undefined` when the group was not the session's.
 */
export const closeSessionForGroup = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  groupId: number,
): Promise<StoredSession | undefined> => {
  const transaction = database.transaction([SESSION_STORE, NODE_STORE], "readwrite");
  const sessions = transaction.objectStore(SESSION_STORE);
  const active = (await sessions.index("status").getAll("active")).find(
    (session) => session.groupId === groupId,
  );

  if (active === undefined) {
    await transaction.done;
    return undefined;
  }

  const nodes = await transaction.objectStore(NODE_STORE).index("sessionId").getAll(active.id);
  const lastPosition = findLastPosition(active, nodes);
  const now = Date.now();
  const closed: StoredSession = {
    ...active,
    status: "closed",
    ...(lastPosition === undefined ? {} : { lastPosition }),
    savedAt: now,
    updatedAt: now,
  };

  await sessions.put(closed);
  await transaction.done;

  return closed;
};
