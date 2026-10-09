/**
 * Measuring how fast this installation actually embeds, and recording that it
 * was measured.
 *
 * Not part of the pipeline — an instrument pointed at it. Provider-agnostic for
 * the same reason as the conformance suite: it takes a loaded session, so it
 * compares one runtime against another rather than describing either.
 *
 * Two details carry the honesty of the number. The input is deterministic and
 * distinct per chunk, so the figure cannot become a measurement of caching; and
 * a warm-up batch runs before the clock starts, because the runtime defers
 * building its inference session to the first request and timing that would
 * report start-up as throughput.
 */

// `ui/` is deliberately absent from this barrel: its components stay out of it so that
// the background, which imports feature barrels and has no use for React, never pulls React in.
// The surface that renders a component imports it from `ui/` by path.

export {
  BENCHMARK_CHUNK_COUNT,
  BENCHMARK_CHUNK_WORDS,
  MINIMUM_CHUNKS_PER_SECOND,
} from "./constants";
export { benchmarkRequestSchemas, benchmarkResponseSchemas } from "./schemas";
export { buildBenchmarkChunks } from "./model/buildBenchmarkChunks";
export { measureEmbeddingThroughput } from "./model/measureEmbeddingThroughput";
export type {
  MeasureEmbeddingThroughputOptions,
  ThroughputMeasurement,
} from "./model/measureEmbeddingThroughput";
export type { BenchmarkRequestType, BenchmarkResponseType } from "./types";
