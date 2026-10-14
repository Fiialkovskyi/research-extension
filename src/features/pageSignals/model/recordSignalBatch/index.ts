import type { IDBPDatabase } from "idb";

import { recordPageMarks } from "@/features/activityLog";
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
  /** Pastes since the last batch. */
  pasteEvents: number;
}

/**
 * Adds a page's batch to the node of the page that sent it, through the same
 * accumulation as every other signal: scroll keeps its deepest reading, copies
 * and pastes add up. Each copy and paste is also logged at `at`, when the batch
 * arrived, for the session's timeline.
 *
 * @returns Where the batch went, or why it went nowhere.
 */
export const recordSignalBatch = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sender: PageSender,
  batch: SignalBatch,
  at: number,
): Promise<SignalTarget> => {
  const target = await readSignalTarget(database, sender);

  if (target.node === undefined) {
    return target;
  }

  const node = await addNodeSignals(database, target.node.id, batch);

  await recordPageMarks(database, {
    sessionId: node.sessionId,
    nodeId: node.id,
    copyEvents: batch.copyEvents,
    pasteEvents: batch.pasteEvents,
    at,
  });

  return { node, isCurrent: target.isCurrent };
};
