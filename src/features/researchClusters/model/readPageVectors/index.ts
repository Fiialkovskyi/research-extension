import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, VECTOR_STORE } from "@/shared/storage";

/**
 * Each page's vector in one embedding space: the mean of its chunks' vectors,
 * scaled to unit length. Reads the space's own key range only, and keeps the
 * session's vectors.
 */
export const readPageVectors = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  spaceId: string,
): Promise<Map<string, Float32Array>> => {
  const stored = await database.getAll(VECTOR_STORE, IDBKeyRange.bound([spaceId], [spaceId, []]));
  const sums = new Map<string, Float32Array>();

  for (const { nodeId, vector, sessionId: owner } of stored) {
    if (owner === sessionId) {
      const sum = sums.get(nodeId) ?? new Float32Array(vector.length);

      vector.forEach((value, index) => {
        sum[index] = (sum[index] ?? 0) + value;
      });
      sums.set(nodeId, sum);
    }
  }

  for (const sum of sums.values()) {
    const length = Math.hypot(...sum);

    if (length > 0) {
      sum.forEach((value, index) => {
        sum[index] = value / length;
      });
    }
  }

  return sums;
};
