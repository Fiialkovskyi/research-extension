import type * as v from "valibot";

import type { recordedPageSchema, recordedSessionSchema } from "./schemas";

export type RecordedPage = v.InferOutput<typeof recordedPageSchema>;
export type RecordedSession = v.InferOutput<typeof recordedSessionSchema>;
