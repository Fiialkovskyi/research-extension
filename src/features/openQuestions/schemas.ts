import * as v from "valibot";

import { MAXIMUM_QUESTIONS } from "./constants";

/**
 * An `openQuestions@1` answer. Mirrors `prompts/openQuestions@1.schema.json`;
 * `constants.spec.ts` keeps the two in step.
 */
export const openQuestionsAnswerSchema = v.object({
  questions: v.pipe(
    v.array(v.object({ question: v.string(), query: v.string() })),
    v.maxLength(MAXIMUM_QUESTIONS),
  ),
});

/** A stored question, as encrypted into the store. */
export const openQuestionSchema = v.object({ question: v.string(), query: v.string() });

/** What a questions job works on. */
export const suggestQuestionsPayloadSchema = v.object({
  factSetHash: v.string(),
  requestedAt: v.optional(v.number()),
});

export const openQuestionsViewSchema = v.object({
  questions: v.array(openQuestionSchema),
  /** Whether questions were ever suggested for this session. */
  hasQuestions: v.boolean(),
  isStale: v.boolean(),
  isPending: v.boolean(),
  /** Whether a generation model is on, which suggesting needs together with facts. */
  hasModel: v.boolean(),
  canSuggest: v.boolean(),
  /** The model that suggested them, by name, when there are any (REQ-LIN-005). */
  modelName: v.nullable(v.string()),
});

export const openQuestionRequestSchemas = {
  "questions.read": v.object({}),
  /** Suggest questions now, while the user is active ("Suggest questions", "Refresh"). */
  "questions.refresh": v.object({}),
} as const;

export const openQuestionResponseSchemas = {
  "questions.view": v.object({ view: v.nullable(openQuestionsViewSchema) }),
  "questions.refreshing": v.object({ queued: v.boolean() }),
} as const;
