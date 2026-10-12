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
  /** Save the active session: keep its record and tabs, close its tabs. */
  "session.save": v.object({}),
  /** The saved sessions, newest first. */
  "library.list": v.object({}),
  /** Reopen a saved session's tabs and make it active again. */
  "session.resume": v.object({ sessionId: v.string() }),
} as const;

export const researchLibraryResponseSchemas = {
  "session.saved": v.object({ sessionId: v.string(), title: v.string() }),
  "session.saveFailed": v.object({ reason: v.string() }),
  "library.listed": v.object({ sessions: v.array(savedSessionSummarySchema) }),
  "session.resumed": v.object({ sessionId: v.string(), title: v.string() }),
  "session.resumeFailed": v.object({ reason: v.string() }),
} as const;
