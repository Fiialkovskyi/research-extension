import type { IDBPDatabase } from "idb";

import { AI_SETUP_STORE, MODEL_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

import type { AiSetupStatus } from "../../types";
import { isAiSetUp } from "../isAiSetUp";

/**
 * Where the user stands with local AI, read from storage alone, so asking never
 * reaches Ollama.
 */
export const readAiSetupStatus = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<AiSetupStatus> => {
  const [record, models] = await Promise.all([
    database.get(AI_SETUP_STORE, "user"),
    database.getAll(MODEL_STORE),
  ]);

  return {
    isSetUp: isAiSetUp(models),
    isStarted: record?.startedAt !== undefined,
    isBannerCollapsed: record?.isBannerCollapsed ?? false,
  };
};
