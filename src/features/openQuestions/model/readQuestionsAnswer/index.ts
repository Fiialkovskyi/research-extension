import * as v from "valibot";

import { MAXIMUM_QUESTION_QUERY_LENGTH } from "../../constants";
import { openQuestionsAnswerSchema } from "../../schemas";
import type { OpenQuestion } from "../../types";

/**
 * Reads the model's open questions: validated against the schema, each
 * question and query trimmed, empty ones dropped, queries capped.
 *
 * @throws When the answer is not JSON or not in the schema; the job then fails.
 */
export const readQuestionsAnswer = (text: string): OpenQuestion[] => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The questions are not JSON.");
  }

  const result = v.safeParse(openQuestionsAnswerSchema, parsed);

  if (!result.success) {
    throw new Error(
      `The questions do not match the schema: ${result.issues[0]?.message ?? "unknown"}`,
    );
  }

  return result.output.questions.flatMap(({ question, query }) => {
    const asked = question.trim();
    const searched = query.replaceAll(/\s+/gu, " ").trim().slice(0, MAXIMUM_QUESTION_QUERY_LENGTH);

    return asked === "" || searched === "" ? [] : [{ question: asked, query: searched }];
  });
};
