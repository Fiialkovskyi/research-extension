import type { IDBPDatabase } from "idb";

import { closeNode, readTabNode } from "@/features/researchGraph";
import { getActiveSession } from "@/features/researchSession";
import type { ResearchDatabaseSchema } from "@/shared/storage";

/**
 * Closes the node a session tab shows, because the tab was closed. The node
 * keeps its signals and edges. A tab with no open node changes nothing.
 */
export const closeTabNode = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  tabId: number,
): Promise<void> => {
  const session = await getActiveSession(database);

  if (session === undefined) {
    return;
  }

  const node = await readTabNode(database, session.id, tabId);

  if (node !== undefined) {
    await closeNode(database, node.id);
  }
};
