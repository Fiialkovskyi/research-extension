import type { IDBPDatabase } from "idb";
import * as v from "valibot";

import { getDataKey } from "@/features/dataProtection";
import type { GenerateRequest, GenerationStream } from "@/features/inference";
import { checkpointJob } from "@/features/jobQueue";
import { readSnapshotText } from "@/features/pageSnapshots";
import { CHUNKER_VERSION, chunkText } from "@/features/snapshotEmbeddings";
import {
  CHUNK_STORE,
  EXTRACTION_STORE,
  FACT_STORE,
  recordInferenceRun,
  type ResearchDatabaseSchema,
  SNAPSHOT_STORE,
  type StoredExtraction,
  type StoredJob,
} from "@/shared/storage";

import {
  FACT_ANSWER_MAX_TOKENS,
  FACT_CONTEXT_TOKENS,
  FACT_EXTRACTION_PROMPT,
} from "../../constants";
import { extractFactsCheckpointSchema, extractFactsPayloadSchema } from "../../schemas";
import { buildFactExtractionMessages } from "../buildFactExtractionMessages";
import { isQuoteGrounded } from "../isQuoteGrounded";
import { readFactAnswer } from "../readFactAnswer";
import { buildExtractionRecord } from "./utils/buildExtractionRecord";
import { sealFact } from "./utils/sealFact";

export interface RunFactExtractionJobOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  job: StoredJob;
  /** The active generation model's ref, which provenance records. */
  modelRef: string;
  /** Generates with the active generation model. */
  generate: (request: GenerateRequest) => GenerationStream;
  /**
   * Whether the next chunk may start now (REQ-MOD-008). Asked before each
   * chunk, so a user who comes back stops the job after the chunk in flight.
   */
  mayContinue: () => Promise<boolean>;
  now?: () => number;
}

/**
 * Extracts one snapshot's facts, one chunk per request: builds the delimited request, validates the
 * answer, keeps the facts whose quote is in the chunk (REQ-SYN-002), encrypts
 * them and stores them with the snapshot's extraction record, then
 * checkpoints. A chunk redone after an unload overwrites its facts and its
 * outcome, so nothing is counted or stored twice.
 *
 * @returns `"deferred"` when it stopped because it may not go on now.
 * @throws When the snapshot is gone, or generation fails; the queue retries.
 */
export const runFactExtractionJob = async ({
  database,
  job,
  modelRef,
  generate,
  mayContinue,
  now = Date.now,
}: RunFactExtractionJobOptions): Promise<"deferred" | undefined> => {
  const { snapshotId } = v.parse(extractFactsPayloadSchema, job.payload);
  const snapshot = await database.get(SNAPSHOT_STORE, snapshotId);

  if (snapshot === undefined) {
    throw new Error(`Snapshot "${snapshotId}" no longer exists.`);
  }

  const text = (await readSnapshotText(database, snapshotId)) ?? "";
  const chunks = chunkText(text);
  const prompt = `${FACT_EXTRACTION_PROMPT.id}@${FACT_EXTRACTION_PROMPT.version}`;
  const resumeAt = v.safeParse(extractFactsCheckpointSchema, job.checkpoint);
  const chunkWrite = database.transaction(CHUNK_STORE, "readwrite");

  // The same chunks the embedding job writes, under the same ids, so a fact's
  // chunk exists whether or not an embedding model is active.
  await Promise.all([
    ...chunks.map(({ index, start, end }) =>
      chunkWrite.store.put({
        id: `${snapshotId}:${index}`,
        snapshotId,
        nodeId: snapshot.nodeId,
        sessionId: snapshot.sessionId,
        chunkerVersion: CHUNKER_VERSION,
        index,
        start,
        end,
      }),
    ),
    chunkWrite.done,
  ]);

  const stored = await database.get(EXTRACTION_STORE, snapshotId);
  let record: StoredExtraction =
    stored?.prompt === prompt && stored.modelRef === modelRef
      ? stored
      : {
          snapshotId,
          sessionId: snapshot.sessionId,
          nodeId: snapshot.nodeId,
          modelRef,
          prompt,
          chunkCount: chunks.length,
          chunkOutcomes: [],
          chunksDone: 0,
          keptCount: 0,
          droppedCount: 0,
          invalidChunkCount: 0,
        };
  const dataKey = await getDataKey(database);

  if (chunks.length === 0) {
    // Nothing to read: recorded as done, with nothing found.
    await database.put(EXTRACTION_STORE, { ...record, finishedAt: now() });

    return undefined;
  }

  for (const chunk of chunks.slice(resumeAt.success ? resumeAt.output.nextChunk : 0)) {
    if (!(await mayContinue())) {
      return "deferred";
    }

    const passage = text.slice(chunk.start, chunk.end);
    const startedAt = now();
    const result = await generate({
      messages: buildFactExtractionMessages(passage),
      maxTokens: FACT_ANSWER_MAX_TOKENS,
      temperature: 0,
      responseSchema: FACT_EXTRACTION_PROMPT.jsonSchema,
      contextTokens: FACT_CONTEXT_TOKENS,
    }).final();
    const answer = readFactAnswer(result.text);

    await recordInferenceRun(database, {
      runId: crypto.randomUUID(),
      modelRef,
      device: result.device,
      durationMs: now() - startedAt,
      outcome: answer.isValid ? "ok" : "failed",
      itemCount: 1,
      startedAt,
    });

    const facts = answer.isValid ? answer.answer.facts : [];
    const grounded = facts.filter(({ quote }) => isQuoteGrounded(quote, passage));
    const provenance = { modelRef, prompt, chunkerVersion: CHUNKER_VERSION, extractedAt: now() };
    const sealed = await Promise.all(
      grounded.map((fact, position) =>
        sealFact(
          dataKey,
          fact,
          {
            sessionId: snapshot.sessionId,
            nodeId: snapshot.nodeId,
            snapshotId,
            chunkIndex: chunk.index,
            position,
          },
          provenance,
        ),
      ),
    );

    record = buildExtractionRecord(record, chunk.index, {
      kept: grounded.length,
      dropped: facts.length - grounded.length,
      isInvalid: !answer.isValid,
    });

    if (record.chunksDone === record.chunkCount) {
      record = { ...record, finishedAt: now() };
    }

    const write = database.transaction([FACT_STORE, EXTRACTION_STORE], "readwrite");
    const factStore = write.objectStore(FACT_STORE);
    // A redone chunk may keep fewer facts than before: its old ones go first.
    const earlier = IDBKeyRange.bound(
      `${snapshotId}:${chunk.index}:`,
      `${snapshotId}:${chunk.index}:￿`,
    );

    await Promise.all([
      factStore.delete(earlier),
      ...sealed.map((fact) => factStore.put(fact)),
      write.objectStore(EXTRACTION_STORE).put(record),
      write.done,
    ]);
    await checkpointJob(database, job.id, { nextChunk: chunk.index + 1 });
  }

  return undefined;
};
