import * as v from "valibot";

/** What the suite reads out of the extension's database and tab group API. */
export const researchSnapshotSchema = v.object({
  sessions: v.array(v.object({ title: v.string(), groupId: v.number(), status: v.string() })),
  nodes: v.array(
    v.object({
      url: v.string(),
      transitionType: v.string(),
      tabState: v.string(),
      hasOpener: v.boolean(),
      hasParent: v.boolean(),
    }),
  ),
  edges: v.array(v.object({ kind: v.string() })),
  /** The groups as the extension sees them, with the extension's ids. */
  groups: v.array(v.object({ id: v.number(), title: v.string() })),
});
