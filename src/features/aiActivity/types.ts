import type * as v from "valibot";

import type { activityStateSchema, sessionTotalsSchema } from "./schemas";

/** What the popup's strip shows. */
export type ActivityState = v.InferOutput<typeof activityStateSchema>;

/** What AI has finished for the active session. */
export type SessionTotals = v.InferOutput<typeof sessionTotalsSchema>;
