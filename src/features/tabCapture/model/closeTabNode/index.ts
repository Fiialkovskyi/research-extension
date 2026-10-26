import type { IDBPDatabase } from "idb";

import { closeNode, readTabNode } from "@/features/researchGraph";
import { getSessionForTab, NO_TAB_GROUP } from "@/features/researchSession";
import type { ResearchDatabaseSchema } from "@/shared/storage";

/**
 * Closes the node a session tab shows, because the tab was closed. The tab
 * belongs to whichever active session has an open page for it. The node
 * keeps its signals and edges. A tab with no open node changes nothing.
 */
export const closeTabNode = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  tabId: number,
): Promise<void> => {
  const session = await getSessionForTab(database, { tabId, groupId: NO_TAB_GROUP });

  if (session === undefined) {
    return;
  }

  const node = await readTabNode(database, session.id, tabId);

  if (node !== undefined) {
    await closeNode(database, node.id);
  }
};
