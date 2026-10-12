import * as v from "valibot";

/** One page on the map. */
export const mapNodeSnapshotSchema = v.object({
  id: v.string(),
  label: v.string(),
  /** `serp` for a search, which the map labels with its query. */
  kind: v.picklist(["serp", "page"]),
  /** Everything the node says, labels included. */
  text: v.string(),
  tabState: v.picklist(["open", "closed"]),
  /** Whether the node can be activated: an open page is a button. */
  isButton: v.boolean(),
  /** Top-left corner of the node's box, in CSS pixels of the page. */
  top: v.number(),
  left: v.number(),
});

/** What the map page shows. */
export const mapSnapshotSchema = v.object({
  /** Changes only when the page is reloaded. */
  documentId: v.string(),
  /**
   * When the number of drawn nodes last changed, in epoch milliseconds, or
   * null if it has not changed since the first read.
   */
  nodesChangedAt: v.nullable(v.number()),
  empty: v.boolean(),
  sessionTitle: v.nullable(v.string()),
  nodes: v.array(mapNodeSnapshotSchema),
  edges: v.array(
    v.object({ id: v.string(), kind: v.picklist(["sameTab", "opener", "refinement", "other"]) }),
  ),
});
