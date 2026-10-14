import * as v from "valibot";

import { egressLogSchema, type egressRequestSchema } from "./schemas";

export type EgressRequest = v.InferOutput<typeof egressRequestSchema>;

/**
 * Parses what the reader script returned.
 *
 * @throws If it is not a JSON string holding the recorded requests.
 */
export const parseEgressLog = (raw: unknown): EgressRequest[] => {
  if (typeof raw !== "string") {
    throw new Error(`Expected the egress log as a JSON string, got ${typeof raw}.`);
  }

  return v.parse(egressLogSchema, JSON.parse(raw));
};
