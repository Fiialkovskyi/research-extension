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

export {
  BENCHMARK_CHUNK_COUNT,
  benchmarkRequestSchemas,
  benchmarkResponseSchemas,
  BENCHMARK_CHUNK_WORDS,
  MINIMUM_CHUNKS_PER_SECOND,
} from "./constants";
export { buildBenchmarkChunks } from "./model/buildBenchmarkChunks";
export { measureEmbeddingThroughput } from "./model/measureEmbeddingThroughput";
export type {
  MeasureEmbeddingThroughputOptions,
  ThroughputMeasurement,
} from "./model/measureEmbeddingThroughput";
export type { BenchmarkRequestType, BenchmarkResponseType } from "./constants";
