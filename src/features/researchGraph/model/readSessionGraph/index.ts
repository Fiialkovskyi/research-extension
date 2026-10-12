import type { IDBPDatabase } from "idb";

import { EDGE_STORE, NODE_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

import type { SessionGraph } from "../../types";

/**
 * Reads a session's nodes and edges in one read-only transaction, so the graph
 * is from one moment: no edge can point at a node written after the nodes were
 * read.
 */
export const readSessionGraph = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
): Promise<SessionGraph> => {
  const transaction = database.transaction([NODE_STORE, EDGE_STORE]);
  const [nodes, edges] = await Promise.all([
    transaction.objectStore(NODE_STORE).index("sessionId").getAll(sessionId),
    transaction.objectStore(EDGE_STORE).index("sessionId").getAll(sessionId),
  ]);

  await transaction.done;

  return { nodes, edges };
};
