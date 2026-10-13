import type { IDBPDatabase } from "idb";

import { enqueueJob } from "@/features/jobQueue";
import { getActiveModel } from "@/features/modelRegistry";
import { readClustering } from "@/features/researchClusters";
import { getActiveSession } from "@/features/researchSession";
import { JOB_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

import {
  CLUSTER_SUMMARY_PROMPT,
  SUMMARIZE_CLUSTER_JOB,
  SUMMARIZE_CLUSTER_PRIORITY,
} from "../../constants";
import type { SummarizeClusterPayload } from "../../types";
import { getFactSetHash } from "../getFactSetHash";
import { readClusterFactIds } from "../readClusterFactIds";

/**
 * Asks for a cluster's summary now ("Summarize now", "Refresh"): its job for
 * the cluster's current facts is queued, or found, and marked as asked for,
 * due at once — so it runs while the user is active and skips the debounce.
 * The request is kept on the job, so it outlives an unload.
 *
 * @returns Whether a job was queued: not without an active session, generation
 *   model, the cluster, or facts in it.
 */
export const requestClusterSummary = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  clusterId: string,
  now: number = Date.now(),
): Promise<boolean> => {
  const [session, model] = await Promise.all([
    getActiveSession(database),
    getActiveModel(database, "text-generation"),
  ]);
  const cluster =
    session === undefined
      ? undefined
      : (await readClustering(database, session.id))?.clusters.find(({ id }) => id === clusterId);

  if (session === undefined || model === undefined || cluster === undefined) {
    return false;
  }

  const factIds = await readClusterFactIds(database, cluster);

  if (factIds.length === 0) {
    return false;
  }

  const factSetHash = await getFactSetHash(factIds);
  const payload: SummarizeClusterPayload = { clusterId, factSetHash };
  const job = await enqueueJob(database, {
    type: SUMMARIZE_CLUSTER_JOB,
    sessionId: session.id,
    inputHashes: [session.id, clusterId, factSetHash],
    producerVersion: `${CLUSTER_SUMMARY_PROMPT.id}@${CLUSTER_SUMMARY_PROMPT.version}|${model.ref}`,
    priority: SUMMARIZE_CLUSTER_PRIORITY,
    payload,
  });

  if (job.status === "done") {
    // Already written for these facts; asking again regenerates it.
    await database.put(JOB_STORE, {
      ...job,
      status: "queued",
      attempts: 0,
      nextAttemptAt: now,
      payload: { ...payload, requestedAt: now },
      updatedAt: now,
    });

    return true;
  }

  await database.put(JOB_STORE, {
    ...job,
    nextAttemptAt: job.status === "queued" ? Math.min(job.nextAttemptAt, now) : job.nextAttemptAt,
    payload: { ...payload, requestedAt: now },
    updatedAt: now,
  });

  return true;
};
