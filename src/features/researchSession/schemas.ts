import * as v from "valibot";

/** An active session, flattened to what a surface renders. */
export const sessionSummarySchema = v.object({
  id: v.string(),
  title: v.string(),
  groupId: v.number(),
  /** Pages recorded in the session so far, closed ones included. */
  pageCount: v.number(),
  /** Where the user left off before saving, until they move on; absent otherwise. */
  lastPosition: v.optional(v.object({ title: v.string(), readFraction: v.number() })),
  /** A saved session this one looks like a continuation of, offered until answered. */
  reattachSuggestion: v.optional(v.object({ sessionId: v.string(), title: v.string() })),
});

/** Messages about the session. Starting one is still `tabGroup.create`. */
export const researchSessionRequestSchemas = {
  /** The active sessions, after checking the browser's groups, and which one is viewed. */
  "session.getActive": v.object({}),
  /** Choose which active session the popup, and the pages opened from it, refer to. */
  "session.view": v.object({ sessionId: v.string() }),
} as const;

export const researchSessionResponseSchemas = {
  /**
   * `sessions` are the active sessions, in the order they were started.
   * `viewedId` is the one the popup refers to, or `null` when none is active,
   * so a surface offers to start one. A closed session is a saved one here: it
   * is listed by the library and resumed from it.
   */
  "session.active": v.object({
    sessions: v.array(sessionSummarySchema),
    viewedId: v.nullable(v.string()),
  }),
  "session.viewed": v.object({ viewedId: v.nullable(v.string()) }),
} as const;
