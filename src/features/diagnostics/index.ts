/**
 * What the add-on can say about itself: its network policy, and (spike M0-1)
 * how long its background event page stays alive.
 *
 * On the policy:
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

// `ui/` is deliberately absent from this barrel: its components stay out of it so that
// the background, which imports feature barrels and has no use for React, never pulls React in.
// The surface that renders a component imports it from `ui/` by path.

export {
  HOLD_PAGE_PATH,
  HOLD_PING_INTERVAL_MS,
  HOLD_PORT_NAME,
  LIFETIME_PROBE_JOB,
  LIFETIME_STRATEGIES,
  PROBE_HEARTBEAT_INTERVAL_MS,
  PROBE_SILENCE_LIMIT_MS,
} from "./constants";
export {
  blockedRequestSchema,
  diagnosticsRequestSchemas,
  diagnosticsResponseSchemas,
} from "./schemas";
export type {
  BlockedRequestReport,
  DiagnosticsRequestType,
  DiagnosticsResponseType,
  LifetimeStrategy,
  ProbeCheckpoint,
  ProbeJobPayload,
  ProbeOutcome,
} from "./types";
export { buildHeartbeat, type HeartbeatSource } from "./model/buildHeartbeat";
export { readProbeOutcome } from "./model/readProbeOutcome";
export { runLifetimeProbe, type RunLifetimeProbeOptions } from "./model/runLifetimeProbe";
