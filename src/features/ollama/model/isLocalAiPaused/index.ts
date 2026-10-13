import type { IDBPDatabase } from "idb";

import { getActiveModel } from "@/features/modelRegistry";
import { JOB_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

import { LOCAL_SERVER_FAILURE_PATTERN } from "../../constants";

/**
 * Whether local AI is waiting for Ollama: the active embedding model is
 * Ollama's, and a job is waiting to retry because Ollama did not answer. Read
 * from the queue rather than remembered, so an unloaded background still knows.
 */
export const isLocalAiPaused = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<boolean> => {
  const model = await getActiveModel(database, "embedding");

  if (model?.manifest.reference.hub !== "ollama") {
    return false;
  }

  const jobs = await database.getAll(JOB_STORE);

  return jobs.some(
    ({ status, failureReason }) =>
      (status === "queued" || status === "failed") &&
      failureReason !== undefined &&
      LOCAL_SERVER_FAILURE_PATTERN.test(failureReason),
  );
};
