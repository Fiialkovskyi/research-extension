import * as v from "valibot";

import { recordedSnapshotSchema } from "./schemas";

export type RecordedSnapshot = v.InferOutput<typeof recordedSnapshotSchema>;

/**
 * Parses what the reader script returned.
 *
 * @throws If it is not a JSON string holding the page's snapshot.
 */
export const parseRecordedSnapshot = (raw: unknown): RecordedSnapshot => {
  if (typeof raw !== "string") {
    throw new Error(`Expected the recorded page's snapshot as a JSON string, got ${typeof raw}.`);
  }

  return v.parse(recordedSnapshotSchema, JSON.parse(raw));
};
