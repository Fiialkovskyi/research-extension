import * as v from "valibot";

/** One tab group as the browser's own UI records it. */
export const tabGroupSnapshotSchema = v.object({
  label: v.string(),
  color: v.string(),
  tabCount: v.number(),
});

export const tabGroupsSnapshotSchema = v.array(tabGroupSnapshotSchema);
