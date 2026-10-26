import type { IDBPDatabase } from "idb";

import { METADATA_CHUNK_PREFIX } from "@/features/snapshotEmbeddings";
import { type ResearchDatabaseSchema, VECTOR_STORE } from "@/shared/storage";

const isMetadataChunk = (chunkId: string): boolean => chunkId.startsWith(METADATA_CHUNK_PREFIX);

/**
 * Each page's vector in one embedding space: the mean of its chunks' vectors,
 * scaled to unit length. Reads the space's own key range only, and keeps the
 * session's vectors.
 *
 * A page's metadata vector is the weak one that stands in for its text: it
 * counts only for a page with no vector from its text, so a page read deeply is
 * placed by what it says and never blended with what it says of itself.
 */
export const readPageVectors = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  spaceId: string,
): Promise<Map<string, Float32Array>> => {
  const stored = await database.getAll(VECTOR_STORE, IDBKeyRange.bound([spaceId], [spaceId, []]));
  const sums = new Map<string, Float32Array>();
  const textNodes = new Set(
    stored
      .filter(({ chunkId, sessionId: owner }) => owner === sessionId && !isMetadataChunk(chunkId))
      .map(({ nodeId }) => nodeId),
  );

  for (const { chunkId, nodeId, vector, sessionId: owner } of stored) {
    if (owner === sessionId && !(isMetadataChunk(chunkId) && textNodes.has(nodeId))) {
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
