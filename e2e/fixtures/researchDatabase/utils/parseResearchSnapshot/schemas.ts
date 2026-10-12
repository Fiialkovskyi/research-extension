import * as v from "valibot";

/** What the suite reads out of the extension's database and tab group API. */
export const researchSnapshotSchema = v.object({
  sessions: v.array(v.object({ title: v.string(), groupId: v.number(), status: v.string() })),
  nodes: v.array(
    v.object({
      id: v.string(),
      url: v.string(),
      kind: v.string(),
      /** The search query, on SERP nodes only. */
      query: v.nullable(v.string()),
      transitionType: v.string(),
      tabState: v.string(),
      hasOpener: v.boolean(),
      hasParent: v.boolean(),
      /** When the background recorded the node, in epoch milliseconds. */
      createdAt: v.number(),
      signals: v.object({
        activeDwellMs: v.number(),
        maxScroll: v.number(),
        copyEvents: v.number(),
        focusCount: v.number(),
        revisitCount: v.number(),
      }),
      /** The hash of the page's snapshot, once it has one. */
      contentHash: v.nullable(v.string()),
    }),
  ),
  /** Snapshot records, without their (compressed) text. */
  snapshots: v.array(
    v.object({
      nodeId: v.string(),
      contentHash: v.string(),
      byteLength: v.number(),
      truncated: v.boolean(),
    }),
  ),
  edges: v.array(v.object({ kind: v.string(), from: v.string(), to: v.string() })),
  /** The groups as the extension sees them, with the extension's ids. */
  groups: v.array(v.object({ id: v.number(), title: v.string() })),
});
