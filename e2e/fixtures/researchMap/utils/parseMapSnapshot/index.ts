import * as v from "valibot";

import { type mapNodeSnapshotSchema, mapSnapshotSchema } from "./schemas";

export type MapSnapshot = v.InferOutput<typeof mapSnapshotSchema>;
export type MapNodeSnapshot = v.InferOutput<typeof mapNodeSnapshotSchema>;

/**
 * Parses what the map page reported.
 *
 * @throws If it is not a JSON string of a map snapshot.
 */
export const parseMapSnapshot = (raw: unknown): MapSnapshot => {
  if (typeof raw !== "string") {
    throw new Error(`Expected the map snapshot as a JSON string, got ${typeof raw}.`);
  }

  return v.parse(mapSnapshotSchema, JSON.parse(raw));
};
