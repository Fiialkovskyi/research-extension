import * as v from "valibot";

import { INFERENCE_DEVICES } from "@/shared/modelManifest";

/**
 * Messages that drive a measurement.
 *
 * The device is named by the caller for the same reason activation names it:
 * a throughput figure is meaningless without knowing which compute path
 * produced it, so it is never left to a default.
 */
export const benchmarkRequestSchemas = {
  "benchmark.run": v.object({
    ref: v.pipe(v.string(), v.minLength(1)),
    device: v.optional(v.picklist(INFERENCE_DEVICES)),
  }),
} as const;

export const benchmarkResponseSchemas = {
  "benchmark.measured": v.object({
    ref: v.string(),
    device: v.picklist(INFERENCE_DEVICES),
    chunkCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
    durationMs: v.pipe(v.number(), v.minValue(0)),
    chunksPerSecond: v.pipe(v.number(), v.minValue(0)),
    loadDurationMs: v.pipe(v.number(), v.minValue(0)),
    meetsBudget: v.boolean(),
    /** The worker's threads; absent for a local server, which keeps its own. */
    threadCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  }),
  "benchmark.failed": v.object({ ref: v.string(), reason: v.string() }),
} as const;
