import * as v from "valibot";

import { factExtractionAnswerSchema } from "../../schemas";
import type { FactExtractionAnswer } from "../../types";

/** A chunk's answer: its facts, or why it could not be used. */
export type FactAnswer =
  | { isValid: true; answer: FactExtractionAnswer }
  | { isValid: false; reason: string };

/**
 * Reads the model's answer for one chunk. The runtime was asked to follow the
 * schema, but that is not a guarantee the extension controls, so the answer is
 * parsed and validated here; one that fails is reported, never used.
 */
export const readFactAnswer = (text: string): FactAnswer => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return { isValid: false, reason: "The answer is not JSON." };
  }

  const result = v.safeParse(factExtractionAnswerSchema, parsed);

  return result.success
    ? { isValid: true, answer: result.output }
    : {
        isValid: false,
        reason: `The answer does not match the schema: ${result.issues[0]?.message ?? "unknown"}`,
      };
};
