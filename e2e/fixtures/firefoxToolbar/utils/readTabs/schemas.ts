import * as v from "valibot";

/** One tab of the window, as the chrome context reports it. */
export const tabSnapshotSchema = v.object({
  url: v.string(),
  selected: v.boolean(),
  /** The label of the tab's group, or null when it is in none. */
  group: v.nullable(v.string()),
});

export const tabsSnapshotSchema = v.array(tabSnapshotSchema);
