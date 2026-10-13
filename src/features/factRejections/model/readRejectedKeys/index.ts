import type { IDBPDatabase } from "idb";

import { REJECTION_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

/** The keys of the facts the user rejected in a session. */
export const readRejectedKeys = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
): Promise<Set<string>> =>
  new Set(
    (await database.getAllFromIndex(REJECTION_STORE, "sessionId", sessionId)).map(({ key }) => key),
  );
