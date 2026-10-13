import type { IDBPDatabase } from "idb";

import { CHUNK_STORE, type ResearchDatabaseSchema, VECTOR_STORE } from "@/shared/storage";

/**
 * How much of a session a space covers (REQ-LIN-003): of the session's
 * chunks, how many have a vector in the space. A session switches to a new
 * space only when it covers every chunk.
 */
export const readSpaceCoverage = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  spaceId: string,
): Promise<{ covered: number; total: number }> => {
  const chunkIds = await database.getAllKeysFromIndex(CHUNK_STORE, "sessionId", sessionId);
  const hits = await Promise.all(
    chunkIds.map(
      async (chunkId) =>
        (await database.count(
          VECTOR_STORE,
          IDBKeyRange.bound([spaceId, chunkId, 0], [spaceId, chunkId, Infinity]),
        )) > 0,
    ),
  );

  return { covered: hits.filter(Boolean).length, total: chunkIds.length };
};
