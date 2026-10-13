import type { IDBPDatabase } from "idb";
import * as v from "valibot";

import { encryptBytes, getDataKey } from "@/features/dataProtection";
import type { GenerateRequest, GenerationStream } from "@/features/inference";
import { readClustering } from "@/features/researchClusters";
import {
  recordInferenceRun,
  type ResearchDatabaseSchema,
  type StoredJob,
  SUMMARY_STORE,
} from "@/shared/storage";

import {
  CLUSTER_SUMMARY_PROMPT,
  MAXIMUM_SUMMARY_FACTS,
  SUMMARY_ANSWER_MAX_TOKENS,
  SUMMARY_CONTEXT_TOKENS,
} from "../../constants";
import { summarizeClusterPayloadSchema } from "../../schemas";
import { buildSummaryMessages } from "../buildSummaryMessages";
import { getFactSetHash } from "../getFactSetHash";
import { readClusterFactIds } from "../readClusterFactIds";
import { readSummaryAnswer } from "../readSummaryAnswer";
import { selectSummaryFacts } from "../selectSummaryFacts";
import { readSummaryFacts } from "./utils/readSummaryFacts";

export interface RunClusterSummaryJobOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  job: StoredJob;
  /** The active generation model's ref, which the summary records. */
  modelRef: string;
  generate: (request: GenerateRequest) => GenerationStream;
  now?: () => number;
}

/**
 * Writes one cluster's summary (REQ-SYN-003, REQ-LIN-007): one model run over
 * at most {@link MAXIMUM_SUMMARY_FACTS} of the cluster's facts, its statements
 * mapped back to the facts they cite and stored encrypted, replacing the
 * cluster's previous summary.
 *
 * A job whose fact set is no longer the cluster's — facts changed again while
 * it waited — has been superseded by a newer one and does nothing; so does one
 * for a cluster that no longer exists.
 *
 * @returns Whether a summary was written.
 * @throws When the answer is not a summary in the schema; the queue retries.
 */
export const runClusterSummaryJob = async ({
  database,
  job,
  modelRef,
  generate,
  now = Date.now,
}: RunClusterSummaryJobOptions): Promise<boolean> => {
  const { clusterId, factSetHash } = v.parse(summarizeClusterPayloadSchema, job.payload);
  const { sessionId } = job;

  if (sessionId === undefined) {
    throw new Error("A summary job carries no session.");
  }

  const cluster = (await readClustering(database, sessionId))?.clusters.find(
    ({ id }) => id === clusterId,
  );
  const factIds = cluster === undefined ? [] : await readClusterFactIds(database, cluster);

  if (factIds.length === 0 || (await getFactSetHash(factIds)) !== factSetHash) {
    return false;
  }

  const dataKey = await getDataKey(database);
  const { selected, omittedCount } = selectSummaryFacts(
    await readSummaryFacts(database, dataKey, factIds),
    MAXIMUM_SUMMARY_FACTS,
  );
  const { messages, labels } = buildSummaryMessages(selected);
  const startedAt = now();
  const result = await generate({
    messages,
    maxTokens: SUMMARY_ANSWER_MAX_TOKENS,
    temperature: 0,
    responseSchema: CLUSTER_SUMMARY_PROMPT.jsonSchema,
    contextTokens: SUMMARY_CONTEXT_TOKENS,
  }).final();
  let statements;

  try {
    statements = readSummaryAnswer(result.text, labels);
  } finally {
    await recordInferenceRun(database, {
      runId: crypto.randomUUID(),
      modelRef,
      device: result.device,
      durationMs: now() - startedAt,
      outcome: statements === undefined ? "failed" : "ok",
      itemCount: selected.length,
      startedAt,
    });
  }

  const sealed = await encryptBytes(dataKey, new TextEncoder().encode(JSON.stringify(statements)));

  await database.put(SUMMARY_STORE, {
    id: `${sessionId}:${clusterId}`,
    sessionId,
    clusterId,
    factSetHash,
    citedFactIds: [...new Set(statements.flatMap(({ factIds: cited }) => cited))],
    inputFactCount: selected.length,
    omittedFactCount: omittedCount,
    modelRef,
    prompt: `${CLUSTER_SUMMARY_PROMPT.id}@${CLUSTER_SUMMARY_PROMPT.version}`,
    generatedAt: now(),
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedStatements: sealed.ciphertext,
  });

  return true;
};
