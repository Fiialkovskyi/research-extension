import type { IDBPDatabase } from "idb";

import {
  type ResearchDatabaseSchema,
  SESSION_STORE,
  SPACE_STORE,
  VECTOR_STORE,
} from "@/shared/storage";

/**
 * Deletes a space's vectors and marks it removed (REQ-LIN-004). A space a
 * session uses is refused: its vectors are what that session's similarity
 * work reads.
 *
 * @returns Whether the space was removed.
 */
export const removeSpace = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  spaceId: string,
  now: number = Date.now(),
): Promise<boolean> => {
  const transaction = database.transaction([SPACE_STORE, SESSION_STORE, VECTOR_STORE], "readwrite");
  const space = await transaction.objectStore(SPACE_STORE).get(spaceId);
  const inUse = (await transaction.objectStore(SESSION_STORE).getAll()).some(
    ({ activeEmbeddingSpaceId }) => activeEmbeddingSpaceId === spaceId,
  );

  if (space === undefined || inUse) {
    await transaction.done;
    return false;
  }

  await Promise.all([
    transaction
      .objectStore(VECTOR_STORE)
      .delete(IDBKeyRange.bound([spaceId, "", 0], [spaceId, "￿", Infinity])),
    transaction.objectStore(SPACE_STORE).put({ ...space, removedAt: now }),
    transaction.done,
  ]);

  return true;
};
