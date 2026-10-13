import type { IDBPDatabase } from "idb";

import { ENTITY_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

/**
 * Undoes a merge: the entity stands on its own again, with its facts, which
 * always pointed at it. It is marked separated, and since only a new
 * subject's own entity is ever merged, it is not merged by meaning again.
 *
 * @returns Whether the entity existed.
 */
export const separateEntity = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  entityId: string,
): Promise<boolean> => {
  const transaction = database.transaction(ENTITY_STORE, "readwrite");
  const entity = await transaction.store.get(entityId);

  if (entity === undefined) {
    await transaction.done;
    return false;
  }

  const { mergedInto: _merged, ...separated } = entity;

  await transaction.store.put({ ...separated, isSeparated: true });
  await transaction.done;

  return true;
};
