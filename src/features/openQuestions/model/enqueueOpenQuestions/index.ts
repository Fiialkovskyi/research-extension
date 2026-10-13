import type { IDBPDatabase } from "idb";

import { getFactSetHash } from "@/features/clusterSummaries";
import { enqueueJob } from "@/features/jobQueue";
import { getActiveModel } from "@/features/modelRegistry";
import { getActiveSession } from "@/features/researchSession";
import { QUESTION_STORE, type ResearchDatabaseSchema, type StoredJob } from "@/shared/storage";

import {
  QUESTIONS_DEBOUNCE_MS,
  SUGGEST_QUESTIONS_JOB,
  SUGGEST_QUESTIONS_PRIORITY,
} from "../../constants";
import { getQuestionsProducer } from "../getQuestionsProducer";
import { readSessionFactIds } from "../readSessionFactIds";

/**
 * Queues open questions for the active session once its facts have settled:
 * due {@link QUESTIONS_DEBOUNCE_MS} from now, identified by the fact set so a
 * newer set supersedes it. Nothing when the session has no facts, no
 * generation model is active, or questions for these facts and model exist.
 *
 * @returns The job queued or found, if any.
 */
export const enqueueOpenQuestions = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  now: number = Date.now(),
): Promise<StoredJob | undefined> => {
  const [session, model] = await Promise.all([
    getActiveSession(database),
    getActiveModel(database, "text-generation"),
  ]);

  if (session === undefined || model === undefined) {
    return undefined;
  }

  const factIds = await readSessionFactIds(database, session.id);

  if (factIds.length === 0) {
    return undefined;
  }

  const factSetHash = await getFactSetHash(factIds);
  const stored = await database.get(QUESTION_STORE, session.id);

  // Questions about these facts stay, whatever model wrote them (REQ-LIN-005).
  if (stored?.factSetHash === factSetHash) {
    return undefined;
  }

  return enqueueJob(database, {
    type: SUGGEST_QUESTIONS_JOB,
    sessionId: session.id,
    inputHashes: [session.id, factSetHash],
    producerVersion: getQuestionsProducer(model.ref),
    priority: SUGGEST_QUESTIONS_PRIORITY,
    payload: { factSetHash },
    notBefore: now + QUESTIONS_DEBOUNCE_MS,
  });
};
