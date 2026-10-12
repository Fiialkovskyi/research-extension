import type { IDBPDatabase } from "idb";

import { NODE_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

/**
 * Gives a node the title its page reported after it was recorded.
 *
 * A page's title usually arrives after its navigation commits, so a node is
 * first recorded with whatever the tab showed then. A blank title, an
 * unchanged one, or a node that does not exist changes nothing.
 */
export const updateNodeTitle = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  nodeId: string,
  title: string,
): Promise<void> => {
  const nextTitle = title.trim();
  const transaction = database.transaction(NODE_STORE, "readwrite");
  const node = await transaction.store.get(nodeId);

  if (node !== undefined && nextTitle !== "" && node.title !== nextTitle) {
    await transaction.store.put({ ...node, title: nextTitle });
  }

  await transaction.done;
};
