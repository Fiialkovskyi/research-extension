import type { IDBPDatabase } from "idb";

import { NODE_STORE, type ResearchDatabaseSchema, type StoredNode } from "@/shared/storage";

import type { SignalObservation } from "../../types";
import { mergeNodeSignals } from "./utils/mergeNodeSignals";

/**
 * Adds new observations to a node's signals.
 *
 * Read and write share one `readwrite` transaction, so two observations for
 * the same node arriving together are both counted rather than one
 * overwriting the other.
 *
 * @throws If no node has that id: an observation for a page that was never
 *   recorded is a capture bug, not something to drop quietly.
 */
export const addNodeSignals = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  nodeId: string,
  observation: SignalObservation,
): Promise<StoredNode> => {
  const transaction = database.transaction(NODE_STORE, "readwrite");
  const node = await transaction.store.get(nodeId);

  if (node === undefined) {
    throw new Error(`No node is recorded under "${nodeId}".`);
  }

  const merged = mergeNodeSignals(node, observation);

  await transaction.store.put(merged);
  await transaction.done;

  return merged;
};
