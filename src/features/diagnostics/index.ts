/**
 * What the add-on can say about its own network policy.
 *
 * The policy is the enforcement point for the no-egress guarantee, so the
 * useful question is not whether it is active but what it refused. A blocked
 * request is otherwise nearly invisible: the fetch fails and the reason appears
 * only in a console nobody is watching.
 *
 * Violations are collected in the **background**, because they are reported
 * where the request was attempted — a listener on a surface would never see
 * what the background was refused.
 */

export {
  blockedRequestSchema,
  diagnosticsRequestSchemas,
  diagnosticsResponseSchemas,
} from "./constants";
export type {
  BlockedRequestReport,
  DiagnosticsRequestType,
  DiagnosticsResponseType,
} from "./constants";
