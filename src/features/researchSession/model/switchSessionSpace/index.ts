import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, SESSION_STORE, SPACE_STORE } from "@/shared/storage";

/**
 * Moves a session to a new embedding space in one write (REQ-LIN-003), once
 * the caller found the space covers every chunk. The space it leaves is
 * retired unless another session still uses it, which starts its 14 days
 * (REQ-LIN-004); a space revived by the switch is no longer retired.
 *
 * @returns The space the session left, or `undefined` when it had none or
 *   does not exist.
 */
export const switchSessionSpace = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  spaceId: string,
  now: number = Date.now(),
): Promise<string | undefined> => {
  const transaction = database.transaction([SESSION_STORE, SPACE_STORE], "readwrite");
  const sessions = transaction.objectStore(SESSION_STORE);
  const spaces = transaction.objectStore(SPACE_STORE);
  const session = await sessions.get(sessionId);

  if (session === undefined) {
    await transaction.done;
    return undefined;
  }

  const left = session.activeEmbeddingSpaceId;

  await sessions.put({ ...session, activeEmbeddingSpaceId: spaceId });

  const revived = await spaces.get(spaceId);

  if (revived?.retiredAt !== undefined) {
    const { retiredAt: _retired, ...active } = revived;

    await spaces.put(active);
  }

  if (left !== undefined && left !== spaceId) {
    const stillUsed = (await sessions.getAll()).some(
      (other) => other.id !== sessionId && other.activeEmbeddingSpaceId === left,
    );
    const leftSpace = await spaces.get(left);

    if (!stillUsed && leftSpace !== undefined) {
      await spaces.put({ ...leftSpace, retiredAt: now });
    }
  }

  await transaction.done;

  return left;
};
