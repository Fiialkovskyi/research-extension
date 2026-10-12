import * as v from "valibot";

/** One page as the "What was recorded" view shows it. Never its text. */
export const recordedPageSchema = v.object({
  id: v.string(),
  title: v.string(),
  url: v.string(),
  domain: v.string(),
  kind: v.picklist(["serp", "page"]),
  tabState: v.picklist(["open", "closed"]),
  createdAt: v.number(),
  signals: v.object({
    activeDwellMs: v.number(),
    maxScroll: v.number(),
    copyEvents: v.number(),
    focusCount: v.number(),
    revisitCount: v.number(),
    quickReturnCount: v.number(),
  }),
  snapshot: v.nullable(
    v.object({ byteLength: v.number(), truncated: v.boolean(), capturedAt: v.number() }),
  ),
  vectorCount: v.number(),
});

/** A session and everything recorded for it, as the view shows it. */
export const recordedSessionSchema = v.object({
  id: v.string(),
  title: v.string(),
  status: v.picklist(["active", "closed", "saved"]),
  pages: v.array(recordedPageSchema),
});

export const recordedDataRequestSchemas = {
  /** What the live session recorded. */
  "recorded.read": v.object({}),
  /** A page's snapshot text, decrypted. */
  "recorded.readText": v.object({ nodeId: v.string() }),
  /** Delete a page and everything derived from it. */
  "node.delete": v.object({ nodeId: v.string() }),
  /** Delete a session and everything recorded for it. */
  "session.delete": v.object({ sessionId: v.string() }),
  /** Select the "What was recorded" tab, opening one if none is open. */
  "recorded.open": v.object({}),
} as const;

export const recordedDataResponseSchemas = {
  "recorded.session": v.object({ session: v.nullable(recordedSessionSchema) }),
  "recorded.text": v.object({ nodeId: v.string(), text: v.nullable(v.string()) }),
  "node.deleted": v.object({ nodeId: v.string(), deleted: v.boolean() }),
  "session.deleted": v.object({ sessionId: v.string(), deleted: v.boolean() }),
  "recorded.opened": v.object({}),
} as const;
