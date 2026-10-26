import * as v from "valibot";

/** A saved session as the library lists it. */
export const savedSessionSummarySchema = v.object({
  id: v.string(),
  title: v.string(),
  savedAt: v.number(),
  pageCount: v.number(),
  lastPosition: v.nullable(v.object({ title: v.string(), readFraction: v.number() })),
});

export const researchLibraryRequestSchemas = {
  /** The saved sessions, newest first. */
  "library.list": v.object({}),
  /** Reopen a saved session's tabs and make it active again. */
  "session.resume": v.object({ sessionId: v.string() }),
  /** Continue a saved session in the place of the active one, which joins it. */
  "session.reattach": v.object({ savedSessionId: v.string() }),
  /** Keep the active session apart from the saved session it was offered. */
  "session.keepSeparate": v.object({}),
} as const;

export const researchLibraryResponseSchemas = {
  "library.listed": v.object({ sessions: v.array(savedSessionSummarySchema) }),
  "session.resumed": v.object({ sessionId: v.string(), title: v.string() }),
  "session.resumeFailed": v.object({ reason: v.string() }),
  "session.reattached": v.object({ sessionId: v.string(), title: v.string() }),
  "session.reattachFailed": v.object({ reason: v.string() }),
  "session.keptSeparate": v.object({}),
} as const;
