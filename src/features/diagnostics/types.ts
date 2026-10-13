import type * as v from "valibot";

import type { LIFETIME_STRATEGIES } from "./constants";
import type {
  blockedRequestSchema,
  diagnosticsRequestSchemas,
  diagnosticsResponseSchemas,
  probeCheckpointSchema,
  probeJobPayloadSchema,
  probeOutcomeSchema,
} from "./schemas";

export type BlockedRequestReport = v.InferOutput<typeof blockedRequestSchema>;
export type DiagnosticsRequestType = keyof typeof diagnosticsRequestSchemas;
export type DiagnosticsResponseType = keyof typeof diagnosticsResponseSchemas;
export type LifetimeStrategy = (typeof LIFETIME_STRATEGIES)[number];
/** How a background-lifetime probe run went, read from its heartbeats. */
export type ProbeOutcome = v.InferOutput<typeof probeOutcomeSchema>;
export type ProbeJobPayload = v.InferOutput<typeof probeJobPayloadSchema>;
export type ProbeCheckpoint = v.InferOutput<typeof probeCheckpointSchema>;
