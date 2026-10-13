import type { IDBPDatabase } from "idb";

import { enqueueJob } from "@/features/jobQueue";
import { getActiveModel } from "@/features/modelRegistry";
import { readSessionGraph } from "@/features/researchGraph";
import { getActiveSession } from "@/features/researchSession";
import {
  EXTRACTION_STORE,
  type ResearchDatabaseSchema,
  SNAPSHOT_STORE,
  type StoredJob,
} from "@/shared/storage";

import { EXTRACT_FACTS_JOB, EXTRACT_FACTS_PRIORITY } from "../../constants";
import type { ExtractFactsPayload } from "../../types";
import { getFactProducerVersion } from "../getFactProducerVersion";

/**
 * Queues fact extraction for every snapshot of the active session — every
 * deep-read page, since only those have one (REQ-SYN-001) — with the active
 * text-generation model.
 *
 * Idempotent: a job is identified by the snapshot, its content, the prompt
 * version and the model, so this can run whenever there may be something new.
 * A page already extracted, by any model, is not queued again (REQ-LIN-005).
 *
 * @returns The jobs as the queue now holds them; none without an active
 *   session or an active text-generation model.
 */
export const enqueueFactExtractions = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<StoredJob[]> => {
  const [session, model] = await Promise.all([
    getActiveSession(database),
    getActiveModel(database, "text-generation"),
  ]);

  if (session === undefined || model?.manifest.contract.family !== "text-generation") {
    return [];
  }

  const { nodes } = await readSessionGraph(database, session.id);
  const jobs: StoredJob[] = [];

  for (const node of nodes) {
    const snapshot =
      node.snapshotId === undefined
        ? undefined
        : await database.get(SNAPSHOT_STORE, node.snapshotId);

    // A page extracted by any model keeps its facts through a model swap
    // (REQ-LIN-005): only pages never extracted are queued.
    const isExtracted =
      snapshot !== undefined && (await database.get(EXTRACTION_STORE, snapshot.id)) !== undefined;

    if (snapshot !== undefined && !isExtracted) {
      const payload: ExtractFactsPayload = { snapshotId: snapshot.id };

      jobs.push(
        await enqueueJob(database, {
          type: EXTRACT_FACTS_JOB,
          sessionId: session.id,
          inputHashes: [snapshot.id, snapshot.contentHash],
          producerVersion: getFactProducerVersion(model.ref),
          priority: EXTRACT_FACTS_PRIORITY,
          payload,
        }),
      );
    }
  }

  return jobs;
};
