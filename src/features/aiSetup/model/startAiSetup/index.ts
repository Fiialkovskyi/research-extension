import type { IDBPDatabase } from "idb";

import { AI_SETUP_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

/**
 * Records that the user started setting AI up, which is what lets the
 * extension contact Ollama at all. The first time is kept: starting again
 * changes nothing.
 */
export const startAiSetup = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  now: number,
): Promise<void> => {
  const transaction = database.transaction(AI_SETUP_STORE, "readwrite");
  const record = await transaction.store.get("user");

  if (record?.startedAt === undefined) {
    await transaction.store.put({ ...record, id: "user", startedAt: now });
  }

  await transaction.done;
};
