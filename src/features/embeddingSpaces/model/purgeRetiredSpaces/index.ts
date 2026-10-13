import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, SPACE_STORE } from "@/shared/storage";

import { SPACE_RETENTION_MS } from "../../constants";
import { removeSpace } from "../removeSpace";

/**
 * Removes every space retired more than {@link SPACE_RETENTION_MS} ago and not
 * yet removed (REQ-LIN-004).
 *
 * @returns The ids of the spaces removed.
 */
export const purgeRetiredSpaces = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  now: number = Date.now(),
): Promise<string[]> => {
  const expired = (await database.getAll(SPACE_STORE)).filter(
    ({ retiredAt, removedAt }) =>
      retiredAt !== undefined && removedAt === undefined && now - retiredAt > SPACE_RETENTION_MS,
  );
  const removed: string[] = [];

  for (const { id } of expired) {
    if (await removeSpace(database, id, now)) {
      removed.push(id);
    }
  }

  return removed;
};
