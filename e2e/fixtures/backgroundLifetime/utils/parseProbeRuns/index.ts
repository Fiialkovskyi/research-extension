import * as v from "valibot";

import { probeRunsSchema } from "./schemas";

export type ProbeRun = v.InferOutput<typeof probeRunsSchema>[number];

/**
 * Parses what the probe reader script returned.
 *
 * @throws When the page reported something other than a list of runs.
 */
export const parseProbeRuns = (raw: unknown): ProbeRun[] => {
  if (typeof raw !== "string") {
    throw new Error(`The probe reader returned ${typeof raw}, not JSON text.`);
  }

  return v.parse(probeRunsSchema, JSON.parse(raw));
};
