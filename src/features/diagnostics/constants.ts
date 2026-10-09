import * as v from "valibot";

/**
 * What the add-on can say about its own network policy.
 *
 * The policy is the enforcement point for the no-egress guarantee, so the
 * useful question is not whether it is active but what it refused. A blocked
 * request is otherwise nearly invisible — the fetch fails and the reason
 * appears only in a console nobody is watching.
 */
export const diagnosticsRequestSchemas = {
  "diagnostics.read": v.object({}),
} as const;

export const blockedRequestSchema = v.object({
  origin: v.string(),
  directive: v.string(),
});

export const diagnosticsResponseSchemas = {
  "diagnostics.report": v.object({
    /** Origins the policy refused, deduplicated. */
    blocked: v.array(blockedRequestSchema),
    /** Origins the package declares it may reach, for comparison. */
    permittedOrigins: v.array(v.string()),
  }),
} as const;

export type BlockedRequestReport = v.InferOutput<typeof blockedRequestSchema>;
export type DiagnosticsRequestType = keyof typeof diagnosticsRequestSchemas;
export type DiagnosticsResponseType = keyof typeof diagnosticsResponseSchemas;
