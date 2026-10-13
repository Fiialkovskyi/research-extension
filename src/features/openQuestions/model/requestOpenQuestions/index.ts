import type { IDBPDatabase } from "idb";

import { getFactSetHash } from "@/features/clusterSummaries";
import { enqueueJob } from "@/features/jobQueue";
import { getActiveModel } from "@/features/modelRegistry";
import { getActiveSession } from "@/features/researchSession";
import { JOB_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

import { SUGGEST_QUESTIONS_JOB, SUGGEST_QUESTIONS_PRIORITY } from "../../constants";
import { getQuestionsProducer } from "../getQuestionsProducer";
import { readSessionFactIds } from "../readSessionFactIds";

/**
 * Asks for the active session's questions now ("Suggest questions",
 * "Refresh"): the job for its current facts is queued or found, marked as
 * asked for and due at once — so it runs while the user is active.
 *
 * @returns Whether a job was queued: not without a session, a generation
 *   model, or facts.
 */
export const requestOpenQuestions = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  now: number = Date.now(),
): Promise<boolean> => {
  const [session, model] = await Promise.all([
    getActiveSession(database),
    getActiveModel(database, "text-generation"),
  ]);

  if (session === undefined || model === undefined) {
    return false;
  }

  const factIds = await readSessionFactIds(database, session.id);

  if (factIds.length === 0) {
    return false;
  }

  const factSetHash = await getFactSetHash(factIds);
  const job = await enqueueJob(database, {
    type: SUGGEST_QUESTIONS_JOB,
    sessionId: session.id,
    inputHashes: [session.id, factSetHash],
    producerVersion: getQuestionsProducer(model.ref),
    priority: SUGGEST_QUESTIONS_PRIORITY,
    payload: { factSetHash },
  });
  const isDone = job.status === "done";

  await database.put(JOB_STORE, {
    ...job,
    ...(isDone ? { status: "queued" as const, attempts: 0 } : {}),
    nextAttemptAt: isDone || job.status === "queued" ? now : job.nextAttemptAt,
    payload: { factSetHash, requestedAt: now },
    updatedAt: now,
  });

  return true;
};
