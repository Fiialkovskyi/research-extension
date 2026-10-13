import type { IDBPDatabase } from "idb";
import * as v from "valibot";

import { getFactSetHash } from "@/features/clusterSummaries";
import { decryptBytes, getDataKey } from "@/features/dataProtection";
import { getActiveModel } from "@/features/modelRegistry";
import { getLiveSession } from "@/features/researchSession";
import {
  JOB_STORE,
  MODEL_STORE,
  QUESTION_STORE,
  type ResearchDatabaseSchema,
} from "@/shared/storage";

import { SUGGEST_QUESTIONS_JOB } from "../../constants";
import { openQuestionSchema, suggestQuestionsPayloadSchema } from "../../schemas";
import type { OpenQuestion, OpenQuestionsView } from "../../types";
import { readSessionFactIds } from "../readSessionFactIds";

/**
 * Reads the live session's suggested questions as the Synthesis page shows
 * them: decrypted, stale when its facts or model changed, pending when asked
 * for and not yet written. A question set that cannot be read is shown as
 * none, so it can be asked for again.
 *
 * @returns The view, or `undefined` without a live session.
 */
export const readOpenQuestions = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<OpenQuestionsView | undefined> => {
  const session = await getLiveSession(database);

  if (session === undefined) {
    return undefined;
  }

  const [stored, model, installed, jobs, factIds] = await Promise.all([
    database.get(QUESTION_STORE, session.id),
    getActiveModel(database, "text-generation"),
    database.getAllKeys(MODEL_STORE),
    database.getAllFromIndex(JOB_STORE, "sessionId", session.id),
    readSessionFactIds(database, session.id),
  ]);
  const isPending = jobs.some((job) => {
    const payload = v.safeParse(suggestQuestionsPayloadSchema, job.payload);

    return (
      job.type === SUGGEST_QUESTIONS_JOB &&
      (job.status === "queued" || job.status === "running") &&
      payload.success &&
      payload.output.requestedAt !== undefined
    );
  });
  let questions: OpenQuestion[] | undefined;

  if (stored !== undefined) {
    try {
      const plain = await decryptBytes(await getDataKey(database), {
        keyId: stored.keyId,
        cipher: "aes-gcm-256",
        iv: stored.iv,
        ciphertext: stored.encryptedQuestions,
      });

      questions = v.parse(v.array(openQuestionSchema), JSON.parse(new TextDecoder().decode(plain)));
    } catch {
      questions = undefined;
    }
  }

  return {
    questions: questions ?? [],
    hasQuestions: questions !== undefined,
    isStale:
      stored !== undefined &&
      ((await getFactSetHash(factIds)) !== stored.factSetHash ||
        !new Set(installed).has(stored.modelRef)),
    isPending,
    canSuggest: model !== undefined && factIds.length > 0,
  };
};
