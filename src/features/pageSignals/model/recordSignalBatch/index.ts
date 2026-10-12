import type { IDBPDatabase } from "idb";

import { addNodeSignals } from "@/features/researchGraph";
import type { ResearchDatabaseSchema } from "@/shared/storage";

import type { PageSender } from "../../types";
import { readSignalTarget, type SignalTarget } from "../readSignalTarget";

/** What a page saw since its last batch. */
export interface SignalBatch {
  /** The deepest point reached so far, from 0 to 1. */
  maxScroll: number;
  /** Copies since the last batch. */
  copyEvents: number;
}

/**
 * Adds a page's batch to the node of the page that sent it, through the same
 * accumulation as every other signal: scroll keeps its deepest reading, copies
 * add up.
 *
 * @returns Where the batch went, or why it went nowhere.
 */
export const recordSignalBatch = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sender: PageSender,
  batch: SignalBatch,
): Promise<SignalTarget> => {
  const target = await readSignalTarget(database, sender);

  if (target.node === undefined) {
    return target;
  }

  const node = await addNodeSignals(database, target.node.id, batch);

  return { node, isCurrent: target.isCurrent };
};
