import type { IDBPDatabase } from "idb";

import {
  CLUSTERING_STORE,
  type ResearchDatabaseSchema,
  type StoredClustering,
} from "@/shared/storage";

/** Replaces the session's clustering whole, so no reader sees half of one. */
export const storeClustering = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  clustering: StoredClustering,
): Promise<void> => {
  await database.put(CLUSTERING_STORE, clustering);
};
