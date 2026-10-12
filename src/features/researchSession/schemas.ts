import * as v from "valibot";

/** The active session, flattened to what a surface renders. */
export const sessionSummarySchema = v.object({
  id: v.string(),
  title: v.string(),
  groupId: v.number(),
  /** Pages recorded in the session so far, closed ones included. */
  pageCount: v.number(),
});

/** Messages about the session. Starting one is still `tabGroup.create`. */
export const researchSessionRequestSchemas = {
  /** Which session is active or closed, after checking the browser's groups. */
  "session.getActive": v.object({}),
} as const;

export const researchSessionResponseSchemas = {
  /**
   * `session` is `null` when no session is active, so a surface offers to start
   * one. `closedSession` is the session whose group was removed and may still
   * come back, or `null`; starting a new session ends it.
   */
  "session.active": v.object({
    session: v.nullable(sessionSummarySchema),
    closedSession: v.nullable(sessionSummarySchema),
  }),
} as const;
