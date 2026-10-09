import type { IDBPDatabase } from "idb";

import {
  INFERENCE_RUN_STORE,
  type ModelDatabaseSchema,
  type StoredInferenceRun,
} from "../constants";

/**
 * Reads the recorded runs, newest first, optionally narrowed to one model and
 * capped at `limit` runs.
 *
 * Used to report measured throughput and to answer lineage questions such as
 * which device produced a given result. Walks the `startedAt` index backwards,
 * so only the runs returned are read.
 */
export const readInferenceRuns = async (
  database: IDBPDatabase<ModelDatabaseSchema>,
  modelRef?: string,
  limit = Number.POSITIVE_INFINITY,
): Promise<StoredInferenceRun[]> => {
  const runs: StoredInferenceRun[] = [];
  let cursor = await database
    .transaction(INFERENCE_RUN_STORE)
    .store.index("startedAt")
    .openCursor(null, "prev");

  while (cursor !== null && runs.length < limit) {
    if (modelRef === undefined || cursor.value.modelRef === modelRef) {
      runs.push(cursor.value);
    }

    cursor = await cursor.continue();
  }

  return runs;
};
