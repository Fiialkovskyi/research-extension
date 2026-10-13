import * as v from "valibot";

import { summariesSnapshotSchema } from "./schemas";

export type SummariesSnapshot = v.InferOutput<typeof summariesSnapshotSchema>;

/**
 * Parses what the reader script returned.
 *
 * @throws If it is not a JSON string holding the page's snapshot.
 */
export const parseSummariesSnapshot = (raw: unknown): SummariesSnapshot => {
  if (typeof raw !== "string") {
    throw new Error(`Expected the Summaries page's snapshot as a JSON string, got ${typeof raw}.`);
  }

  return v.parse(summariesSnapshotSchema, JSON.parse(raw));
};
