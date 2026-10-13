import * as v from "valibot";

/** What the Summaries page shows. */
export const summariesSnapshotSchema = v.object({
  empty: v.boolean(),
  title: v.nullable(v.string()),
  needsModel: v.boolean(),
  /** Whether the comparison table says it has nothing to compare yet. */
  tableEmpty: v.boolean(),
  /** The gaps listed, by their text. */
  gaps: v.array(v.string()),
  clusters: v.array(
    v.object({ label: v.string(), hasNoFacts: v.boolean(), statements: v.array(v.string()) }),
  ),
});
