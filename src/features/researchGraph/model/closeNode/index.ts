import type { IDBPDatabase } from "idb";

import { NODE_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

/**
 * Marks a node's tab as closed. The node keeps its signals and relations: a
 * closed tab is part of the research, not a mistake to undo.
 *
 * Closing a closed node, or one that does not exist, changes nothing, so a
 * repeated tab-removed event is harmless.
 */
export const closeNode = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  nodeId: string,
): Promise<void> => {
  const transaction = database.transaction(NODE_STORE, "readwrite");
  const node = await transaction.store.get(nodeId);

  if (node !== undefined && node.tabState !== "closed") {
    await transaction.store.put({ ...node, tabState: "closed" });
  }

  await transaction.done;
};
