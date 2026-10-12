import * as v from "valibot";

/** What the "What was recorded" page shows. */
export const recordedSnapshotSchema = v.object({
  empty: v.boolean(),
  title: v.nullable(v.string()),
  entries: v.array(
    v.object({
      nodeId: v.string(),
      heading: v.string(),
      scroll: v.nullable(v.string()),
      copies: v.nullable(v.string()),
      snapshot: v.nullable(v.string()),
      vectors: v.nullable(v.string()),
      /** The page text shown, or null until asked for. */
      text: v.nullable(v.string()),
    }),
  ),
});
