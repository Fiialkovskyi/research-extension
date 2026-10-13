import type { IDBPDatabase } from "idb";

import {
  type ResearchDatabaseSchema,
  SESSION_STORE,
  SPACE_STORE,
  VECTOR_STORE,
} from "@/shared/storage";

import type { SpaceUsage } from "../../types";

/**
 * Every embedding space with its disk use (REQ-LIN-004): the model, how many
 * vectors it holds and roughly how many bytes, whether a session uses it, and
 * when it was retired or removed. Newest first.
 */
export const readSpaceUsage = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<SpaceUsage[]> => {
  const [spaces, sessions] = await Promise.all([
    database.getAll(SPACE_STORE),
    database.getAll(SESSION_STORE),
  ]);
  const used = new Set(
    sessions.flatMap(({ activeEmbeddingSpaceId }) => activeEmbeddingSpaceId ?? []),
  );
  const usage = await Promise.all(
    spaces.map(async (space) => {
      const vectorCount = await database.count(
        VECTOR_STORE,
        IDBKeyRange.bound([space.id, "", 0], [space.id, "￿", Infinity]),
      );

      return {
        id: space.id,
        repository: space.model.repository,
        revision: space.model.revision,
        vectorCount,
        approximateBytes: vectorCount * space.dims * 4,
        inUse: used.has(space.id),
        retiredAt: space.retiredAt ?? null,
        removedAt: space.removedAt ?? null,
        createdAt: space.createdAt,
      };
    }),
  );

  return usage
    .toSorted((a, b) => b.createdAt - a.createdAt)
    .map(({ createdAt: _created, ...space }) => space);
};
