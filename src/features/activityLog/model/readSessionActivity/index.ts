import type { IDBPDatabase } from "idb";

import { ACTIVITY_STORE, type ResearchDatabaseSchema, type StoredActivity } from "@/shared/storage";

/** Reads a session's activity, earliest first. */
export const readSessionActivity = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
): Promise<StoredActivity[]> =>
  (await database.getAllFromIndex(ACTIVITY_STORE, "sessionId", sessionId)).toSorted(
    (first, second) => first.at - second.at || first.endAt - second.endAt,
  );
