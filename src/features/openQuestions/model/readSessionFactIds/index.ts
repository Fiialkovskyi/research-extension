import type { IDBPDatabase } from "idb";

import { readClusterFactIds } from "@/features/clusterSummaries";
import { NODE_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

/**
 * The ids of every fact of a session's pages, without those the user marked
 * wrong — the whole session read as one cluster, so rejections count the same
 * way they do for a summary.
 */
export const readSessionFactIds = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
): Promise<string[]> => {
  const memberIds = await database.getAllKeysFromIndex(NODE_STORE, "sessionId", sessionId);

  return readClusterFactIds(database, { memberIds }, sessionId);
};
