import * as v from "valibot";

export const factRejectionRequestSchemas = {
  /** Mark facts wrong: every fact stating the same thing is hidden. */
  "facts.reject": v.object({ factIds: v.pipe(v.array(v.string()), v.minLength(1)) }),
  /** Undo every rejection of the active session. */
  "facts.restoreRejections": v.object({}),
} as const;

export const factRejectionResponseSchemas = {
  "facts.rejected": v.object({ rejectionCount: v.number() }),
  "facts.rejectionsRestored": v.object({ restoredCount: v.number() }),
} as const;
