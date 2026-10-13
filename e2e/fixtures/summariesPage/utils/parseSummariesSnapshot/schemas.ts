import * as v from "valibot";

/** What the Summaries page shows. */
export const summariesSnapshotSchema = v.object({
  empty: v.boolean(),
  title: v.nullable(v.string()),
  needsModel: v.boolean(),
  clusters: v.array(
    v.object({ label: v.string(), hasNoFacts: v.boolean(), statements: v.array(v.string()) }),
  ),
});
