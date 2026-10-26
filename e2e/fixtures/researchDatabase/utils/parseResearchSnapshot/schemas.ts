import * as v from "valibot";

/** What the suite reads out of the extension's database and tab group API. */
export const researchSnapshotSchema = v.object({
  sessions: v.array(
    v.object({
      id: v.string(),
      title: v.string(),
      groupId: v.number(),
      status: v.string(),
      savedTabCount: v.number(),
    }),
  ),
  nodes: v.array(
    v.object({
      id: v.string(),
      /** The session the node was recorded in. */
      sessionId: v.string(),
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
  /** Snapshot records, without their text. */
  snapshots: v.array(
    v.object({
      nodeId: v.string(),
      contentHash: v.string(),
      byteLength: v.number(),
      truncated: v.boolean(),
      /** The cipher the text was encrypted with, or null if it is stored in the clear. */
      cipher: v.nullable(v.string()),
      /** Whether the record still holds text in the clear, as before encryption. */
      hasPlaintext: v.boolean(),
    }),
  ),
  /** Page metadata records, without the description's words. */
  metadata: v.array(
    v.object({
      nodeId: v.string(),
      title: v.nullable(v.string()),
      siteName: v.nullable(v.string()),
      canonicalUrl: v.nullable(v.string()),
      /** The page's product as stored: name, price and currency; null when none. */
      product: v.nullable(
        v.object({
          name: v.optional(v.string()),
          price: v.optional(v.number()),
          currency: v.optional(v.string()),
        }),
      ),
      /** Whether the description is stored encrypted. */
      hasSealedDescription: v.boolean(),
      /** Whether the record holds a description in the clear, which it must never. */
      hasPlaintextDescription: v.boolean(),
    }),
  ),
  edges: v.array(v.object({ kind: v.string(), from: v.string(), to: v.string() })),
  /** The groups as the extension sees them, with the extension's ids. */
  groups: v.array(v.object({ id: v.number(), title: v.string() })),
});
