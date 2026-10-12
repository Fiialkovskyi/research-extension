import * as v from "valibot";

import { researchSnapshotSchema } from "./schemas";

export type ResearchSnapshot = v.InferOutput<typeof researchSnapshotSchema>;

/**
 * Parses what the reader page returned.
 *
 * @throws If it is not a JSON string holding a snapshot — including the
 *   reader's own `ERROR …` report, whose text is kept in the message.
 */
export const parseResearchSnapshot = (raw: unknown): ResearchSnapshot => {
  if (typeof raw !== "string") {
    throw new Error(`Expected the research snapshot as a JSON string, got ${typeof raw}.`);
  }

  if (raw.startsWith("ERROR ")) {
    throw new Error(`The reader page could not read the database: ${raw.slice(6)}`);
  }

  return v.parse(researchSnapshotSchema, JSON.parse(raw));
};
