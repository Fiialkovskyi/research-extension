import type * as v from "valibot";

import type { savedSessionSummarySchema } from "./schemas";

/** A saved session as the library lists it. */
export type SavedSessionSummary = v.InferOutput<typeof savedSessionSummarySchema>;
