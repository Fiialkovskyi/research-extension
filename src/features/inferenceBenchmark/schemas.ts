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

/** What the timed extraction's answer must be; mirrors `EXTRACTED_TABLE_JSON_SCHEMA`. */
export const extractedTableSchema = v.object({
  products: v.array(
    v.object({
      name: v.string(),
      priceUsd: v.number(),
      weightKg: v.number(),
      batteryWh: v.number(),
      torqueNm: v.number(),
      rangeKm: v.number(),
    }),
  ),
});

/** Asks for extraction from the bundled article to be timed with the active generation model. */
export const generationBenchmarkRequestSchemas = {
  "generation.measure": v.object({}),
} as const;

export const generationBenchmarkResponseSchemas = {
  "generation.measured": v.object({
    ref: v.string(),
    wordCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
    durationMs: v.pipe(v.number(), v.minValue(0)),
    isValid: v.boolean(),
    /** Values the answer got right, of those the article states. */
    correctCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
    expectedCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
    /** Why the answer was discarded, when it was. */
    reason: v.optional(v.string()),
    meetsBudget: v.boolean(),
  }),
  "generation.measureFailed": v.object({ reason: v.string() }),
  /** Sent every second while extraction runs: what has been written so far. */
  "generation.measureProgress": v.object({
    elapsedMs: v.pipe(v.number(), v.minValue(0)),
    characters: v.pipe(v.number(), v.integer(), v.minValue(0)),
  }),
} as const;
