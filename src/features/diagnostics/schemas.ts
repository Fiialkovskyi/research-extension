import * as v from "valibot";

import { LIFETIME_STRATEGIES } from "./constants";

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
  /**
   * Starts a background-lifetime probe run (spike M0-1): the background holds
   * itself busy for `holdMs` under one strategy, writing heartbeats.
   */
  "diagnostics.lifetimeProbe": v.object({
    strategy: v.picklist(LIFETIME_STRATEGIES),
    // Long enough to outlast any idle timeout worth testing, short enough
    // that a forgotten run ends on its own.
    holdMs: v.pipe(v.number(), v.integer(), v.minValue(1_000), v.maxValue(600_000)),
  }),
  /** The probe runs recorded so far, newest first. */
  "diagnostics.readProbes": v.object({}),
} as const;

export const probeOutcomeSchema = v.object({
  runId: v.string(),
  strategy: v.string(),
  holdMs: v.number(),
  startedAt: v.number(),
  state: v.picklist(["running", "completed", "resumed", "stopped"]),
  /** Time held when the last beat was written. */
  lastSeenMs: v.number(),
  longestGapMs: v.number(),
  pageLoads: v.number(),
});

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
  "diagnostics.probeStarted": v.object({ runId: v.string() }),
  "diagnostics.probes": v.object({ runs: v.array(probeOutcomeSchema) }),
} as const;

/** What a queued probe run works on. */
export const probeJobPayloadSchema = v.object({
  runId: v.string(),
  strategy: v.picklist(LIFETIME_STRATEGIES),
  holdMs: v.number(),
});

/** Where a probe run got to, and which page load got it there. */
export const probeCheckpointSchema = v.object({
  elapsedMs: v.number(),
  pageLoadId: v.string(),
});
