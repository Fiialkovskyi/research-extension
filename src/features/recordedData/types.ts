import type * as v from "valibot";

import type { recordedEntitySchema, recordedPageSchema, recordedSessionSchema } from "./schemas";

export type RecordedEntity = v.InferOutput<typeof recordedEntitySchema>;
export type RecordedPage = v.InferOutput<typeof recordedPageSchema>;
export type RecordedSession = v.InferOutput<typeof recordedSessionSchema>;
