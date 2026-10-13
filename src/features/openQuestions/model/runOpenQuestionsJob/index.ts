import type { IDBPDatabase } from "idb";
import * as v from "valibot";

import {
  buildSummaryMessages,
  getFactSetHash,
  readSummaryFacts,
  selectSummaryFacts,
} from "@/features/clusterSummaries";
import { encryptBytes, getDataKey } from "@/features/dataProtection";
import type { GenerateRequest, GenerationStream } from "@/features/inference";
import {
  QUESTION_STORE,
  recordInferenceRun,
  type ResearchDatabaseSchema,
  type StoredJob,
} from "@/shared/storage";

import {
  MAXIMUM_QUESTION_FACTS,
  OPEN_QUESTIONS_PROMPT,
  QUESTIONS_ANSWER_MAX_TOKENS,
  QUESTIONS_CONTEXT_TOKENS,
} from "../../constants";
import { suggestQuestionsPayloadSchema } from "../../schemas";
import type { OpenQuestion } from "../../types";
import { readQuestionsAnswer } from "../readQuestionsAnswer";
import { readSessionFactIds } from "../readSessionFactIds";

export interface RunOpenQuestionsJobOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  job: StoredJob;
  modelRef: string;
  generate: (request: GenerateRequest) => GenerationStream;
  now?: () => number;
}

/**
 * Asks the model for a session's open questions (REQ-SYN-008): one run over
 * at most {@link MAXIMUM_QUESTION_FACTS} of its facts, as data, replacing the
 * session's previous questions, stored encrypted. A job whose fact set is no
 * longer the session's has been superseded and does nothing.
 *
 * @returns Whether questions were stored.
 * @throws When the answer is not in the schema; the queue retries.
 */
export const runOpenQuestionsJob = async ({
  database,
  job,
  modelRef,
  generate,
  now = Date.now,
}: RunOpenQuestionsJobOptions): Promise<boolean> => {
  const { factSetHash } = v.parse(suggestQuestionsPayloadSchema, job.payload);
  const { sessionId } = job;

  if (sessionId === undefined) {
    throw new Error("A questions job carries no session.");
  }

  const factIds = await readSessionFactIds(database, sessionId);

  if (factIds.length === 0 || (await getFactSetHash(factIds)) !== factSetHash) {
    return false;
  }

  const dataKey = await getDataKey(database);
  const { selected } = selectSummaryFacts(
    await readSummaryFacts(database, dataKey, factIds),
    MAXIMUM_QUESTION_FACTS,
  );
  const { messages } = buildSummaryMessages(selected, OPEN_QUESTIONS_PROMPT.instructions);
  const startedAt = now();
  const result = await generate({
    messages,
    maxTokens: QUESTIONS_ANSWER_MAX_TOKENS,
    temperature: 0,
    responseSchema: OPEN_QUESTIONS_PROMPT.jsonSchema,
    contextTokens: QUESTIONS_CONTEXT_TOKENS,
  }).final();
  let questions: OpenQuestion[] | undefined;

  try {
    questions = readQuestionsAnswer(result.text);
  } finally {
    await recordInferenceRun(database, {
      runId: crypto.randomUUID(),
      modelRef,
      device: result.device,
      durationMs: now() - startedAt,
      outcome: questions === undefined ? "failed" : "ok",
      itemCount: selected.length,
      startedAt,
    });
  }

  const sealed = await encryptBytes(dataKey, new TextEncoder().encode(JSON.stringify(questions)));

  await database.put(QUESTION_STORE, {
    sessionId,
    factSetHash,
    modelRef,
    prompt: `${OPEN_QUESTIONS_PROMPT.id}@${OPEN_QUESTIONS_PROMPT.version}`,
    generatedAt: now(),
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedQuestions: sealed.ciphertext,
  });

  return true;
};
