import type { IDBPDatabase } from "idb";

import { enqueueJob } from "@/features/jobQueue";
import { getActiveModel } from "@/features/modelRegistry";
import { getActiveSession } from "@/features/researchSession";
import { EXTRACTION_STORE, type ResearchDatabaseSchema, type StoredJob } from "@/shared/storage";

import { RESOLVE_ENTITIES_JOB } from "../../constants";
import type { ResolveEntitiesPayload } from "../../types";
import { getEntityResolverVersion } from "../getEntityResolverVersion";

/**
 * Queues entity resolution for every page of the active session whose fact
 * extraction has finished. Idempotent: a page is resolved once per name rules
 * and embedding model, and a rerun only assigns facts that have no entity.
 *
 * @returns The jobs as the queue now holds them; none without an active session.
 */
export const enqueueEntityResolutions = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<StoredJob[]> => {
  const session = await getActiveSession(database);

  if (session === undefined) {
    return [];
  }

  const [extractions, embeddingModel] = await Promise.all([
    database.getAllFromIndex(EXTRACTION_STORE, "sessionId", session.id),
    getActiveModel(database, "embedding"),
  ]);
  const jobs: StoredJob[] = [];

  for (const { snapshotId, finishedAt } of extractions) {
    if (finishedAt !== undefined) {
      const payload: ResolveEntitiesPayload = { snapshotId };

      jobs.push(
        await enqueueJob(database, {
          type: RESOLVE_ENTITIES_JOB,
          sessionId: session.id,
          inputHashes: [snapshotId],
          producerVersion: getEntityResolverVersion(embeddingModel?.ref),
          payload,
        }),
      );
    }
  }

  return jobs;
};
