import type { IDBPDatabase } from "idb";

import { EDGE_STORE, type ResearchDatabaseSchema, type StoredEdge } from "@/shared/storage";

import type { NewEdge } from "../../types";

/**
 * Records a relation between two nodes, once.
 *
 * The relation is its own key (`from|to|kind`), so a second write finds the
 * first record and returns it unchanged. Browser events repeat — a tab
 * reported twice, a page woken after an unload replaying what it saw — and the
 * graph must not grow from that.
 */
export const recordEdge = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  edge: NewEdge,
): Promise<StoredEdge> => {
  const id = `${edge.from}|${edge.to}|${edge.kind}`;
  const transaction = database.transaction(EDGE_STORE, "readwrite");
  const existing = await transaction.store.get(id);

  if (existing !== undefined) {
    await transaction.done;
    return existing;
  }

  const recorded: StoredEdge = { ...edge, id, createdAt: Date.now() };

  await transaction.store.add(recorded);
  await transaction.done;

  return recorded;
};
