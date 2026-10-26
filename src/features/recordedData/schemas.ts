import * as v from "valibot";

import { pageProductSchema } from "@/features/pageMetadata";

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
  /**
   * What the page said about itself in its head; null when it said nothing.
   * The description is not included, only that one is kept.
   */
  metadata: v.nullable(
    v.object({
      title: v.optional(v.string()),
      siteName: v.optional(v.string()),
      type: v.optional(v.string()),
      author: v.optional(v.string()),
      publishedAt: v.optional(v.string()),
      canonicalUrl: v.optional(v.string()),
      product: v.optional(pageProductSchema),
      hasDescription: v.boolean(),
    }),
  ),
  vectorCount: v.number(),
  /** Facts extracted from the page and facts dropped as ungrounded; null before extraction starts. */
  facts: v.nullable(v.object({ kept: v.number(), dropped: v.number(), isFinished: v.boolean() })),
});

/**
 * One entity of the session as the view shows it: decrypted, with the facts
 * and pages it holds, its merged entities' included, and the names merged
 * into it, each of which can be separated.
 */
export const recordedEntitySchema = v.object({
  id: v.string(),
  name: v.string(),
  type: v.string(),
  factCount: v.number(),
  pageCount: v.number(),
  merged: v.array(v.object({ id: v.string(), name: v.string() })),
});

/** A session and everything recorded for it, as the view shows it. */
export const recordedSessionSchema = v.object({
  id: v.string(),
  title: v.string(),
  status: v.picklist(["active", "closed", "saved"]),
  pages: v.array(recordedPageSchema),
  /** Whether a text-generation model is active, so facts can be extracted. */
  canExtractFacts: v.boolean(),
  entities: v.array(recordedEntitySchema),
});

export const recordedDataRequestSchemas = {
  /** What the live session recorded. */
  "recorded.read": v.object({ sessionId: v.optional(v.string()) }),
  /** A page's snapshot text, decrypted. */
  "recorded.readText": v.object({ nodeId: v.string(), sessionId: v.optional(v.string()) }),
  /** Delete a page and everything derived from it. */
  "node.delete": v.object({ nodeId: v.string() }),
  /** Delete a session and everything recorded for it. */
  "session.delete": v.object({ sessionId: v.string() }),
  /** Select the "What was recorded" tab, opening one if none is open. */
  "recorded.open": v.object({ sessionId: v.optional(v.string()) }),
} as const;

export const recordedDataResponseSchemas = {
  "recorded.session": v.object({ session: v.nullable(recordedSessionSchema) }),
  "recorded.text": v.object({ nodeId: v.string(), text: v.nullable(v.string()) }),
  "node.deleted": v.object({ nodeId: v.string(), deleted: v.boolean() }),
  "session.deleted": v.object({ sessionId: v.string(), deleted: v.boolean() }),
  "recorded.opened": v.object({}),
} as const;
