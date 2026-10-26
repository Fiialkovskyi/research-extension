import type { IDBPDatabase } from "idb";

import { readTabNode, updateNodeTitle } from "@/features/researchGraph";
import { getSessionForTab, NO_TAB_GROUP } from "@/features/researchSession";
import type { ResearchDatabaseSchema } from "@/shared/storage";

/**
 * Gives the node a session tab shows the title the tab now reports.
 *
 * The title usually arrives after the navigation is recorded, so this is how a
 * node gets its real title. A tab with no open node is outside every session.
 */
export const updateTabTitle = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  tabId: number,
  title: string,
): Promise<void> => {
  const session = await getSessionForTab(database, { tabId, groupId: NO_TAB_GROUP });

  if (session === undefined) {
    return;
  }

  const node = await readTabNode(database, session.id, tabId);

  if (node !== undefined) {
    await updateNodeTitle(database, node.id, title);
  }
};
