import type { StoredHeartbeat } from "@/shared/storage";

import type { LifetimeStrategy } from "../../types";

/** What a probe run knows about itself when it beats. */
export interface HeartbeatSource {
  runId: string;
  strategy: LifetimeStrategy;
  holdMs: number;
  pageLoadId: string;
}

/**
 * Builds one heartbeat row of a probe run.
 *
 * Elapsed time is capped at the hold, so the final beat of a completed run
 * reads exactly the hold and the outcome does not depend on timer jitter.
 */
export const buildHeartbeat = (
  source: HeartbeatSource,
  elapsedMs: number,
  now: number,
): StoredHeartbeat => ({
  runId: source.runId,
  strategy: source.strategy,
  holdMs: source.holdMs,
  elapsedMs: Math.min(Math.max(0, Math.round(elapsedMs)), source.holdMs),
  pageLoadId: source.pageLoadId,
  writtenAt: now,
});
