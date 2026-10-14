import * as v from "valibot";

import { type axeViolationSchema, axeViolationsSchema } from "./schemas";

export type AxeViolation = v.InferOutput<typeof axeViolationSchema>;

/**
 * Parses what the audit script returned.
 *
 * @throws If it is not a JSON string holding the violations.
 */
export const parseAxeViolations = (raw: unknown): AxeViolation[] => {
  if (typeof raw !== "string") {
    throw new Error(`Expected the audit's violations as a JSON string, got ${typeof raw}.`);
  }

  return v.parse(axeViolationsSchema, JSON.parse(raw));
};
