import type { IDBPDatabase } from "idb";

import { INFERENCE_RUN_STORE, MAXIMUM_INFERENCE_RUNS } from "../constants";
import { type ResearchDatabaseSchema, type StoredInferenceRun } from "../types";

/**
 * Records one inference run for lineage and for honest throughput claims.
 *
 * The record carries counts, timings and the device — never the text that was
 * processed. That is a property of {@link StoredInferenceRun}'s shape rather
 * than of this function's discipline: there is no field to put content in, so
 * the log cannot accumulate page text even by mistake.
 *
 * The log is capped at {@link MAXIMUM_INFERENCE_RUNS}: once a write pushes it past
 * the cap, the oldest runs are removed in the same transaction.
 */
export const recordInferenceRun = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  run: StoredInferenceRun,
): Promise<void> => {
  const transaction = database.transaction(INFERENCE_RUN_STORE, "readwrite");

  await transaction.store.put(run);

  let excess = (await transaction.store.count()) - MAXIMUM_INFERENCE_RUNS;

  if (excess > 0) {
    let cursor = await transaction.store.index("startedAt").openCursor();

    while (cursor !== null && excess > 0) {
      await cursor.delete();
      excess -= 1;
      cursor = await cursor.continue();
    }
  }

  await transaction.done;
};
