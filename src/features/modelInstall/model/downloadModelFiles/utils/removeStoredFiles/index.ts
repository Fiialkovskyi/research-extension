import type { IDBPDatabase } from "idb";

import { MODEL_FILE_STORE, type ModelDatabaseSchema } from "@/shared/storage";

/**
 * Removes every file stored for one model.
 *
 * Used to undo a failed install. A model that is partly on disk is worse than
 * one that is absent: the registry would list it, the runtime would try to load
 * it, and the failure would surface far from its cause.
 */
export const removeStoredFiles = async (
  database: IDBPDatabase<ModelDatabaseSchema>,
  ref: string,
): Promise<void> => {
  const keys = await database.getAllKeysFromIndex(MODEL_FILE_STORE, "ref", ref);

  await Promise.all(keys.map((key) => database.delete(MODEL_FILE_STORE, key)));
};
