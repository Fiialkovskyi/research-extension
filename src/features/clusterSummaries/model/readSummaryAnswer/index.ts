import * as v from "valibot";

import { clusterSummaryAnswerSchema } from "../../schemas";
import type { SummaryStatement } from "../../types";

/**
 * Reads the model's summary (REQ-SYN-003): validates it, maps each cited label
 * back to its fact id, drops labels the model was not given, and discards a
 * statement left citing nothing.
 *
 * @throws When the answer is not JSON or not in the schema; the job then fails.
 */
export const readSummaryAnswer = (
  text: string,
  labels: ReadonlyMap<string, string>,
): SummaryStatement[] => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The summary is not JSON.");
  }

  const result = v.safeParse(clusterSummaryAnswerSchema, parsed);

  if (!result.success) {
    throw new Error(
      `The summary does not match the schema: ${result.issues[0]?.message ?? "unknown"}`,
    );
  }

  return result.output.statements.flatMap(({ text: statement, facts }) => {
    const factIds = [
      ...new Set(facts.flatMap((label) => labels.get(label.trim().toUpperCase()) ?? [])),
    ];

    return factIds.length === 0 || statement.trim() === ""
      ? []
      : [{ text: statement.trim(), factIds }];
  });
};
