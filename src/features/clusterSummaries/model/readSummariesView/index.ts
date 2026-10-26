import type { IDBPDatabase } from "idb";
import * as v from "valibot";

import { decryptBytes, getDataKey } from "@/features/dataProtection";
import { readSealedFact } from "@/features/factExtraction";
import { filterRejectedFacts, getFactKey, readRejectedKeys } from "@/features/factRejections";
import { getActiveModel } from "@/features/modelRegistry";
import { readPageSourceDetails } from "@/features/pageMetadata";
import { readClustering } from "@/features/researchClusters";
import type { EmbedConcepts } from "@/shared/resolveConceptKeys";
import {
  FACT_STORE,
  JOB_STORE,
  MODEL_STORE,
  NODE_STORE,
  type ResearchDatabaseSchema,
  type StoredSummary,
  SUMMARY_STORE,
  SESSION_STORE,
} from "@/shared/storage";

import { SUMMARIZE_CLUSTER_JOB } from "../../constants";
import { summarizeClusterPayloadSchema, summaryStatementSchema } from "../../schemas";
import type { ClusterSummaryView, SummaryCitation } from "../../types";
import { getFactSetHash } from "../getFactSetHash";
import { isSummaryStale } from "../isSummaryStale";
import { isNamingProduct } from "./utils/isNamingProduct";
import { readClusterFactIds } from "../readClusterFactIds";
import { readProductCards } from "../readProductCards";
import { readSummaryFacts } from "../readSummaryFacts";

/**
 * Leaves out the statements that name none of the products when at least one
 * statement names one; all are kept when none does, or there is no product.
 */
const keepNamedStatements = <Statement extends { text: string }>(
  statements: readonly Statement[],
  productNames: readonly string[],
): Statement[] => {
  const named = statements.filter(({ text }) =>
    productNames.some((name) => isNamingProduct(text, name)),
  );

  return named.length === 0 ? [...statements] : named;
};

/** What the Summaries page shows: the live session's clusters and their summaries. */
export interface SummariesView {
  title: string;
  clusters: ClusterSummaryView[];
  canSummarize: boolean;
}

/**
 * Reads the live session's clusters as the Summaries page shows them: each
 * with its fact count and its summary, decrypted, every citation resolved to
 * its page and quote — a citation whose fact is gone or rejected is left
 * out — and
 * whether the summary is stale (REQ-LIN-006) or a requested one is pending.
 *
 * @returns The view, or `undefined` without a live session.
 */
export const readSummariesView = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  embed?: EmbedConcepts,
): Promise<SummariesView | undefined> => {
  const session = await database.get(SESSION_STORE, sessionId);

  if (session === undefined) {
    return undefined;
  }

  const [clustering, model, models, jobs, rejectedKeys] = await Promise.all([
    readClustering(database, session.id),
    getActiveModel(database, "text-generation"),
    database.getAll(MODEL_STORE),
    database.getAllFromIndex(JOB_STORE, "sessionId", session.id),
    readRejectedKeys(database, session.id),
  ]);
  const installedRefs = new Set(models.map(({ ref }) => ref));
  const modelNames = new Map(
    models.map(({ ref, manifest }) => [ref, manifest.reference.repository]),
  );
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

              const sealed = await readSealedFact(dataKey, fact);

              // A fact the user marked wrong is not shown as a source.
              if (rejectedKeys.has(await getFactKey(sealed))) {
                return undefined;
              }

              // A citation names its page's site and day when the page said them.
              const details = (await readPageSourceDetails(database, [node.id])).get(node.id);

              return {
                factId,
                pageTitle: node.title.trim() === "" ? node.url : node.title,
                url: node.url,
                quote: sealed.quote,
                ...(details?.siteName === undefined ? {} : { siteName: details.siteName }),
                ...(details?.publishedDate === undefined
                  ? {}
                  : { publishedDate: details.publishedDate }),
              };
            }),
          )
        ).flatMap((citation) => citation ?? []),
      })),
    );
  };

  const clusters = await Promise.all(
    (clustering?.clusters ?? []).map(async (cluster): Promise<ClusterSummaryView> => {
      const factIds = await readClusterFactIds(database, cluster, session.id);
      const summary = await database.get(SUMMARY_STORE, `${session.id}:${cluster.id}`);
      const clusterFacts = await filterRejectedFacts(
        await readSummaryFacts(database, dataKey, factIds, embed),
        rejectedKeys,
      );
      // The products the cluster's facts describe, which a statement must name to be shown.
      const productNames = [
        ...new Set(
          clusterFacts
            .filter(({ entityType }) => entityType === "product")
            .map(({ entityName }) => entityName),
        ),
      ];
      const nodes = new Map(
        (
          await Promise.all(
            [...new Set(clusterFacts.map(({ nodeId }) => nodeId))].map((id) =>
              database.get(NODE_STORE, id),
            ),
          )
        ).flatMap((node) => (node === undefined ? [] : [[node.id, node] as const])),
      );
      const details = await readPageSourceDetails(database, [...nodes.keys()]);
      const { cards, omittedProductCount } = readProductCards(clusterFacts, (fact) => {
        const node = nodes.get(fact.nodeId);
        const source = details.get(fact.nodeId);

        return {
          factId: fact.id,
          pageTitle:
            node === undefined || node.title.trim() === "" ? (node?.url ?? "") : node.title,
          url: node?.url ?? "",
          quote: fact.quote,
          ...(source?.siteName === undefined ? {} : { siteName: source.siteName }),
          ...(source?.publishedDate === undefined ? {} : { publishedDate: source.publishedDate }),
        };
      });

      return {
        clusterId: cluster.id,
        label: cluster.label,
        factCount: factIds.length,
        cards,
        omittedProductCount,
        summary:
          summary === undefined
            ? null
            : {
                statements: keepNamedStatements(await readStatements(summary), productNames),
                isStale: isSummaryStale(summary, await getFactSetHash(factIds), installedRefs),
                omittedFactCount: summary.omittedFactCount,
                generatedAt: summary.generatedAt,
                modelName: modelNames.get(summary.modelRef) ?? summary.modelRef,
              },
        isPending: pending.has(cluster.id),
      };
    }),
  );

  return { title: session.title, clusters, canSummarize: model !== undefined };
};
