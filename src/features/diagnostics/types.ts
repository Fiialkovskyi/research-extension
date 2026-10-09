import type * as v from "valibot";

import type {
  blockedRequestSchema,
  diagnosticsRequestSchemas,
  diagnosticsResponseSchemas,
} from "./schemas";

export type BlockedRequestReport = v.InferOutput<typeof blockedRequestSchema>;
export type DiagnosticsRequestType = keyof typeof diagnosticsRequestSchemas;
export type DiagnosticsResponseType = keyof typeof diagnosticsResponseSchemas;
