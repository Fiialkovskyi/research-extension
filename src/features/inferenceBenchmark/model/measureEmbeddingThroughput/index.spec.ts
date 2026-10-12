import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { measureEmbeddingThroughput } from ".";
import type { WorkerModelSession } from "@/features/inference";
import {
  INFERENCE_RUN_STORE,
  type ResearchDatabaseSchema,
  openResearchDatabase,
  readInferenceRuns,
} from "@/shared/storage";
import { MINIMUM_CHUNKS_PER_SECOND } from "../../constants";

const modelRef = "Xenova/all-MiniLM-L6-v2@" + "a".repeat(40);

/** A clock that advances by a fixed amount on each reading. */
const createStepClock = (stepMs: number) => {
  let value = 0;

  return () => {
    const current = value;
    value += stepMs;

    return current;
  };
};

const createStubSession = (overrides: Partial<WorkerModelSession> = {}): WorkerModelSession => {
  return {
    device: "wasm",
    dimensions: 384,
    loadDurationMs: 1_500,
    embed: vi.fn((texts: readonly string[]) =>
      Promise.resolve(texts.map(() => new Float32Array(384))),
    ),
    ...overrides,
  };
};

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(INFERENCE_RUN_STORE);
});

describe("measureEmbeddingThroughput", () => {
  it("computes chunks per second from the elapsed time", async () => {
    // Ten chunks over a clock that advances 1000 ms once: ten per second.
    const measurement = await measureEmbeddingThroughput({
      session: createStubSession(),
      modelRef,
      database,
      chunkCount: 10,
      now: createStepClock(1_000),
    });

    expect(measurement.chunksPerSecond).toBeCloseTo(10, 6);
    expect(measurement.durationMs).toBe(1_000);
  });

  it("scales with the number of chunks", async () => {
    const measurement = await measureEmbeddingThroughput({
      session: createStubSession(),
      modelRef,
      database,
      chunkCount: 40,
      now: createStepClock(1_000),
    });

    expect(measurement.chunksPerSecond).toBeCloseTo(40, 6);
  });

  it("judges a fast run against the budget", async () => {
    const measurement = await measureEmbeddingThroughput({
      session: createStubSession(),
      modelRef,
      database,
      chunkCount: MINIMUM_CHUNKS_PER_SECOND + 5,
      now: createStepClock(1_000),
    });

    expect(measurement.meetsBudget).toBe(true);
  });

  it("judges a slow run as missing the budget", async () => {
    const measurement = await measureEmbeddingThroughput({
      session: createStubSession(),
      modelRef,
      database,
      chunkCount: MINIMUM_CHUNKS_PER_SECOND - 5,
      now: createStepClock(1_000),
    });

    expect(measurement.meetsBudget).toBe(false);
  });

  it("does not divide by zero on an immeasurably fast run", async () => {
    const measurement = await measureEmbeddingThroughput({
      session: createStubSession(),
      modelRef,
      database,
      chunkCount: 4,
      now: () => 0,
    });

    expect(measurement.chunksPerSecond).toBe(0);
  });

  it("reports loading apart from throughput, since it is paid once", async () => {
    const measurement = await measureEmbeddingThroughput({
      session: createStubSession({ loadDurationMs: 9_000 }),
      modelRef,
      database,
      chunkCount: 10,
      now: createStepClock(1_000),
    });

    expect(measurement.loadDurationMs).toBe(9_000);
    expect(measurement.durationMs).toBe(1_000);
  });

  it("reports the device that actually ran it", async () => {
    const measurement = await measureEmbeddingThroughput({
      session: createStubSession({ device: "webgpu" }),
      modelRef,
      database,
      chunkCount: 4,
      now: createStepClock(1_000),
    });

    expect(measurement.device).toBe("webgpu");
  });

  it("embeds the batch in the document role, as the pipeline would", async () => {
    const session = createStubSession();

    await measureEmbeddingThroughput({
      session,
      modelRef,
      database,
      chunkCount: 3,
      now: createStepClock(1_000),
    });

    expect(session.embed).toHaveBeenCalledWith(expect.any(Array), "document");
  });

  it("records the run, so a throughput claim can be checked later", async () => {
    await measureEmbeddingThroughput({
      session: createStubSession(),
      modelRef,
      database,
      chunkCount: 7,
      now: createStepClock(1_000),
    });

    const [run] = await readInferenceRuns(database, modelRef);

    expect(run).toMatchObject({ device: "wasm", itemCount: 7, outcome: "ok", durationMs: 1_000 });
  });

  it("records the same duration it reports", async () => {
    const measurement = await measureEmbeddingThroughput({
      session: createStubSession(),
      modelRef,
      database,
      chunkCount: 5,
      now: createStepClock(1_000),
    });
    const [run] = await readInferenceRuns(database, modelRef);

    expect(run?.durationMs).toBe(measurement.durationMs);
  });

  it("records a failed run rather than leaving no trace", async () => {
    const session = createStubSession({
      embed: vi.fn().mockRejectedValue(new Error("the runtime gave up")),
    });

    await expect(
      measureEmbeddingThroughput({
        session,
        modelRef,
        database,
        chunkCount: 5,
        now: createStepClock(1_000),
      }),
    ).rejects.toThrow(/gave up/);

    const [run] = await readInferenceRuns(database, modelRef);

    expect(run?.outcome).toBe("failed");
  });

  it("records nothing of the text it embedded", async () => {
    await measureEmbeddingThroughput({
      session: createStubSession(),
      modelRef,
      database,
      chunkCount: 3,
      now: createStepClock(1_000),
    });

    const [run] = await readInferenceRuns(database, modelRef);

    expect(JSON.stringify(run)).not.toContain("battery");
  });
});
