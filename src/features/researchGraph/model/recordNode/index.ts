import type { IDBPDatabase } from "idb";

import { NODE_STORE, type ResearchDatabaseSchema, type StoredNode } from "@/shared/storage";

import type { NewNode } from "../../types";

/**
 * Records a page as a new node of its session, open and not yet engaged with.
 *
 * Every visit is a node of its own, even to a URL already in the graph: the
 * graph records a path, and the same page reached twice is two steps on it.
 */
export const recordNode = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  node: NewNode,
): Promise<StoredNode> => {
  const recorded: StoredNode = {
    ...node,
    id: crypto.randomUUID(),
    signals: { activeDwellMs: 0, maxScroll: 0, copyEvents: 0, focusCount: 0, revisitCount: 0 },
    tabState: "open",
    createdAt: Date.now(),
  };

  await database.add(NODE_STORE, recorded);

  return recorded;
};
