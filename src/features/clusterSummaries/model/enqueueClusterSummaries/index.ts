import type { IDBPDatabase } from "idb";

import { enqueueJob } from "@/features/jobQueue";
import { getActiveModel } from "@/features/modelRegistry";
import { readClustering } from "@/features/researchClusters";
import { getActiveSession } from "@/features/researchSession";
import { type ResearchDatabaseSchema, type StoredJob, SUMMARY_STORE } from "@/shared/storage";

import {
  CLUSTER_SUMMARY_PROMPT,
  SUMMARIZE_CLUSTER_JOB,
  SUMMARIZE_CLUSTER_PRIORITY,
  SUMMARY_DEBOUNCE_MS,
} from "../../constants";
import type { SummarizeClusterPayload } from "../../types";
import { getFactSetHash } from "../getFactSetHash";
import { readClusterFactIds } from "../readClusterFactIds";

/**
 * Queues a summary for every cluster of the active session whose facts have
 * changed since its summary was written, or that has none (REQ-SYN-004): due
 * {@link SUMMARY_DEBOUNCE_MS} from now. The job is identified by the fact set,
 * so a further change queues another, and the first finds itself superseded.
 *
 * @returns The jobs queued or already queued; none without an active session,
 *   a clustering or an active text-generation model.
 */
export const enqueueClusterSummaries = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  now: number = Date.now(),
): Promise<StoredJob[]> => {
  const [session, model] = await Promise.all([
    getActiveSession(database),
    getActiveModel(database, "text-generation"),
  ]);

  if (session === undefined || model === undefined) {
    return [];
  }

  const clustering = await readClustering(database, session.id);
  const jobs: StoredJob[] = [];

  for (const cluster of clustering?.clusters ?? []) {
    const factIds = await readClusterFactIds(database, cluster, session.id);

    if (factIds.length > 0) {
      const factSetHash = await getFactSetHash(factIds);
      const summary = await database.get(SUMMARY_STORE, `${session.id}:${cluster.id}`);

      // A summary of these facts stays, whatever model wrote it (REQ-LIN-005).
      if (summary?.factSetHash !== factSetHash) {
        const payload: SummarizeClusterPayload = { clusterId: cluster.id, factSetHash };

        jobs.push(
          await enqueueJob(database, {
            type: SUMMARIZE_CLUSTER_JOB,
            sessionId: session.id,
            inputHashes: [session.id, cluster.id, factSetHash],
            producerVersion: `${CLUSTER_SUMMARY_PROMPT.id}@${CLUSTER_SUMMARY_PROMPT.version}|${model.ref}`,
            priority: SUMMARIZE_CLUSTER_PRIORITY,
            payload,
            notBefore: now + SUMMARY_DEBOUNCE_MS,
          }),
        );
      }
    }
  }

  return jobs;
};
