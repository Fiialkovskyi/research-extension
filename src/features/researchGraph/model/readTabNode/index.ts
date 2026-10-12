import type { IDBPDatabase } from "idb";

import { NODE_STORE, type ResearchDatabaseSchema, type StoredNode } from "@/shared/storage";

/**
 * Finds the node a tab currently shows: the newest open node recorded for it
 * in the session.
 *
 * A woken background has lost what it knew in memory, and this is how it picks
 * up again. Closed nodes are skipped because tab ids are reused after a
 * restart: an old node with the same id is a different tab's history.
 */
export const readTabNode = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  tabId: number,
): Promise<StoredNode | undefined> => {
  const nodes = await database.getAllFromIndex(NODE_STORE, "sessionTab", [sessionId, tabId]);

  return nodes
    .filter((node) => node.tabState === "open")
    .reduce<StoredNode | undefined>(
      (newest, node) => (newest === undefined || node.createdAt > newest.createdAt ? node : newest),
      undefined,
    );
};
