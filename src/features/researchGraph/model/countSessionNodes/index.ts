import type { IDBPDatabase } from "idb";

import { NODE_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

/**
 * Counts the pages a session has recorded, closed ones included: a page the
 * user has moved on from is still part of the research.
 */
export const countSessionNodes = (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
): Promise<number> => {
  return database.countFromIndex(NODE_STORE, "sessionId", sessionId);
};
