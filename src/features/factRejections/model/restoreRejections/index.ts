import type { IDBPDatabase } from "idb";

import { REJECTION_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

/**
 * Undoes every rejection of a session: its rejected facts show again.
 *
 * @returns How many rejections were removed.
 */
export const restoreRejections = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
): Promise<number> => {
  const write = database.transaction(REJECTION_STORE, "readwrite");
  const keys = await write.store.index("sessionId").getAllKeys(sessionId);

  await Promise.all([...keys.map((key) => write.store.delete(key)), write.done]);

  return keys.length;
};
