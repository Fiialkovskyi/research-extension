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
  /** Which session is active, after checking that its group still exists. */
  "session.getActive": v.object({}),
} as const;

export const researchSessionResponseSchemas = {
  /** `null` when no session is active, so a surface offers to start one. */
  "session.active": v.object({
    session: v.nullable(sessionSummarySchema),
  }),
} as const;
