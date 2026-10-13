import type { IDBPDatabase } from "idb";
import * as v from "valibot";

import { decryptBytes, getDataKey } from "@/features/dataProtection";
import { readSealedFact } from "@/features/factExtraction";
import { getActiveModel } from "@/features/modelRegistry";
import { readClustering } from "@/features/researchClusters";
import { getLiveSession } from "@/features/researchSession";
import {
  FACT_STORE,
  JOB_STORE,
  MODEL_STORE,
  NODE_STORE,
  type ResearchDatabaseSchema,
  type StoredSummary,
  SUMMARY_STORE,
} from "@/shared/storage";

import { SUMMARIZE_CLUSTER_JOB } from "../../constants";
import { summarizeClusterPayloadSchema, summaryStatementSchema } from "../../schemas";
import type { ClusterSummaryView, SummaryCitation } from "../../types";
import { getFactSetHash } from "../getFactSetHash";
import { isSummaryStale } from "../isSummaryStale";
import { readClusterFactIds } from "../readClusterFactIds";

/** What the Summaries page shows: the live session's clusters and their summaries. */
export interface SummariesView {
  title: string;
  clusters: ClusterSummaryView[];
  canSummarize: boolean;
}

/**
 * Reads the live session's clusters as the Summaries page shows them: each
 * with its fact count and its summary, decrypted, every citation resolved to
 * its page and quote — a citation whose fact is gone is left out — and
 * whether the summary is stale (REQ-LIN-006) or a requested one is pending.
 *
 * @returns The view, or `undefined` without a live session.
 */
export const readSummariesView = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<SummariesView | undefined> => {
  const session = await getLiveSession(database);

  if (session === undefined) {
    return undefined;
  }

  const [clustering, model, installed, jobs] = await Promise.all([
    readClustering(database, session.id),
    getActiveModel(database, "text-generation"),
    database.getAllKeys(MODEL_STORE),
    database.getAllFromIndex(JOB_STORE, "sessionId", session.id),
  ]);
  const installedRefs = new Set(installed);
  const pending = new Set(
    jobs.flatMap((job) => {
      const payload = v.safeParse(summarizeClusterPayloadSchema, job.payload);

      return job.type === SUMMARIZE_CLUSTER_JOB &&
        (job.status === "queued" || job.status === "running") &&
        payload.success &&
        payload.output.requestedAt !== undefined
        ? [payload.output.clusterId]
        : [];
    }),
  );
  const dataKey = await getDataKey(database);

  /** A summary's statements, decrypted, with their citations resolved. */
  const readStatements = async (summary: StoredSummary) => {
    const plain = await decryptBytes(dataKey, {
      keyId: summary.keyId,
      cipher: "aes-gcm-256",
      iv: summary.iv,
      ciphertext: summary.encryptedStatements,
    });
    const statements = v.parse(
      v.array(summaryStatementSchema),
      JSON.parse(new TextDecoder().decode(plain)),
    );

    return Promise.all(
      statements.map(async ({ text, factIds }) => ({
        text,
        citations: (
          await Promise.all(
            factIds.map(async (factId): Promise<SummaryCitation | undefined> => {
              const fact = await database.get(FACT_STORE, factId);
              const node =
                fact === undefined ? undefined : await database.get(NODE_STORE, fact.nodeId);

              if (fact === undefined || node === undefined) {
                return undefined;
              }

              return {
                factId,
                pageTitle: node.title.trim() === "" ? node.url : node.title,
                url: node.url,
                quote: (await readSealedFact(dataKey, fact)).quote,
              };
            }),
          )
        ).flatMap((citation) => citation ?? []),
      })),
    );
  };

  const clusters = await Promise.all(
    (clustering?.clusters ?? []).map(async (cluster): Promise<ClusterSummaryView> => {
      const factIds = await readClusterFactIds(database, cluster);
      const summary = await database.get(SUMMARY_STORE, `${session.id}:${cluster.id}`);

      return {
        clusterId: cluster.id,
        label: cluster.label,
        factCount: factIds.length,
        summary:
          summary === undefined
            ? null
            : {
                statements: await readStatements(summary),
                isStale: isSummaryStale(summary, await getFactSetHash(factIds), installedRefs),
                omittedFactCount: summary.omittedFactCount,
                generatedAt: summary.generatedAt,
              },
        isPending: pending.has(cluster.id),
      };
    }),
  );

  return { title: session.title, clusters, canSummarize: model !== undefined };
};
