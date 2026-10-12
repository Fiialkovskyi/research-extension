import type * as v from "valibot";

import type {
  researchSessionRequestSchemas,
  researchSessionResponseSchemas,
  sessionSummarySchema,
} from "./schemas";

export type SessionSummary = v.InferOutput<typeof sessionSummarySchema>;
export type ResearchSessionRequestType = keyof typeof researchSessionRequestSchemas;
export type ResearchSessionResponseType = keyof typeof researchSessionResponseSchemas;
