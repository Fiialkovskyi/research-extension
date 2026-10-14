import * as v from "valibot";

/** One request the add-on triggered: where it went, and its content policy type. */
export const egressRequestSchema = v.object({ url: v.string(), type: v.number() });

export const egressLogSchema = v.array(egressRequestSchema);
