import type { IDBPDatabase } from "idb";

import {
  CLUSTERING_STORE,
  type ResearchDatabaseSchema,
  type StoredClustering,
} from "@/shared/storage";

/** The session's latest clustering, or `undefined` before its first. */
export const readClustering = (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
): Promise<StoredClustering | undefined> => database.get(CLUSTERING_STORE, sessionId);
