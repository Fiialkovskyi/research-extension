import type { IDBPDatabase } from "idb";

import type { WorkerModelSession } from "@/features/inference";
import type { InferenceDevice } from "@/shared/modelManifest";
import { type ModelDatabaseSchema, recordInferenceRun } from "@/shared/storage";
import { BENCHMARK_CHUNK_COUNT, MINIMUM_CHUNKS_PER_SECOND, WARM_UP_CHUNKS } from "../../constants";
import { buildBenchmarkChunks } from "../buildBenchmarkChunks";

/** What a benchmark run measured. */
export interface ThroughputMeasurement {
  /** The device that actually ran it, not the one requested. */
  device: InferenceDevice;
  chunkCount: number;
  durationMs: number;
  chunksPerSecond: number;
  /** Loading time, reported apart from throughput because it is paid once. */
  loadDurationMs: number;
  /** Whether the measurement clears the budget it is judged against. */
  meetsBudget: boolean;
}

export interface MeasureEmbeddingThroughputOptions {
  session: WorkerModelSession;
  modelRef: string;
  database: IDBPDatabase<ModelDatabaseSchema>;
  chunkCount?: number;
  /** Injected so the arithmetic can be tested against a known clock. */
  now?: () => number;
}

/**
 * Measures how fast this installation embeds, and records that it did.
 *
 * Reported in chunks per second because that is the unit the budget is written
 * in, and chunks are what the synthesis pipeline will actually feed it.
 *
 * Loading is excluded from the throughput figure and reported separately. So is
 * session creation, which the runtime defers to the first inference rather than
 * doing at load: a warm-up batch runs before the clock starts. Without it the
 * figure folds in start-up and understates steady-state speed — on the software
 * path, by enough to change the verdict against the budget.
 *
 * Every run goes into the content-free log, which is what lets a claim about
 * throughput be checked later instead of taken on trust.
 */
export const measureEmbeddingThroughput = async (
  options: MeasureEmbeddingThroughputOptions,
): Promise<ThroughputMeasurement> => {
  const {
    session,
    modelRef,
    database,
    chunkCount = BENCHMARK_CHUNK_COUNT,
    now = () => performance.now(),
  } = options;

  const chunks = buildBenchmarkChunks(chunkCount);

  const startedAtWallClock = Date.now();
  let startedAt = now();
  let outcome: "ok" | "failed" = "ok";
  // Read once and shared: measuring again for the return value would record one
  // duration in the log and report a different one to the caller.
  let durationMs = 0;

  try {
    // The runtime creates its inference session on first use, not on load — a
    // model reports a load time of a few milliseconds and then pays seconds on
    // its first batch. Timing that would measure start-up and call it
    // throughput, so a small batch runs first and is thrown away. Inside the
    // try block, because a failure here is still a failed run worth recording.
    await session.embed(chunks.slice(0, WARM_UP_CHUNKS), "document");

    // The clock starts only now, with the session already built.
    startedAt = now();

    // Embedded in the document role: that is what the pipeline does with page
    // text, and on a model with asymmetric prefixes the two roles are not the
    // same amount of work.
    await session.embed(chunks, "document");
  } catch (error) {
    outcome = "failed";
    throw error;
  } finally {
    durationMs = now() - startedAt;

    await recordInferenceRun(database, {
      runId: crypto.randomUUID(),
      modelRef,
      device: session.device,
      durationMs,
      outcome,
      itemCount: chunks.length,
      startedAt: startedAtWallClock,
    });
  }

  const chunksPerSecond = durationMs === 0 ? 0 : (chunks.length / durationMs) * 1000;

  return {
    device: session.device,
    chunkCount: chunks.length,
    durationMs,
    chunksPerSecond,
    loadDurationMs: session.loadDurationMs,
    meetsBudget: chunksPerSecond >= MINIMUM_CHUNKS_PER_SECOND,
  };
};
