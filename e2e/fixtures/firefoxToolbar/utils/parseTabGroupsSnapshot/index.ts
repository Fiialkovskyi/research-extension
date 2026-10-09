import * as v from "valibot";

import { type tabGroupSnapshotSchema, tabGroupsSnapshotSchema } from "./schemas";

export type TabGroupSnapshot = v.InferOutput<typeof tabGroupSnapshotSchema>;

/**
 * Parses the list of tab groups the chrome context returned.
 *
 * @throws If the value is not a JSON string, or its content is not that list.
 */
export const parseTabGroupsSnapshot = (raw: unknown): TabGroupSnapshot[] => {
  if (typeof raw !== "string") {
    throw new Error(`Expected the tab groups as a JSON string, got ${typeof raw}.`);
  }

  return v.parse(tabGroupsSnapshotSchema, JSON.parse(raw));
};
