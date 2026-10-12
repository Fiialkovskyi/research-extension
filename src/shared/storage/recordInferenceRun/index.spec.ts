import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { recordInferenceRun } from ".";
import { INFERENCE_RUN_STORE, MAXIMUM_INFERENCE_RUNS } from "../constants";
import { type ResearchDatabaseSchema, type StoredInferenceRun } from "../types";
import { openResearchDatabase } from "../openResearchDatabase";

const run: StoredInferenceRun = {
  runId: "11111111-1111-4111-8111-111111111111",
  modelRef: "Xenova/all-MiniLM-L6-v2@751bff37182d3f1213fa05d7196b954e230abad9",
  device: "wasm",
  durationMs: 1234,
  outcome: "ok",
  itemCount: 20,
  startedAt: 1_760_000_000_000,
};

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(INFERENCE_RUN_STORE);
});

describe("recordInferenceRun", () => {
  it("stores the run under its identifier", async () => {
    await recordInferenceRun(database, run);

    expect(await database.get(INFERENCE_RUN_STORE, run.runId)).toEqual(run);
  });

  it("records the device, so a result can be traced to what produced it", async () => {
    await recordInferenceRun(database, { ...run, device: "webgpu" });

    const stored = await database.get(INFERENCE_RUN_STORE, run.runId);

    expect(stored?.device).toBe("webgpu");
  });

  it("records a failed run too, so a failure is not invisible", async () => {
    await recordInferenceRun(database, { ...run, outcome: "failed" });

    const stored = await database.get(INFERENCE_RUN_STORE, run.runId);

    expect(stored?.outcome).toBe("failed");
  });

  it("holds nothing but counts, timings and identity", async () => {
    await recordInferenceRun(database, run);

    const stored = await database.get(INFERENCE_RUN_STORE, run.runId);

    // Pinned deliberately: adding a field that could carry embedded or
    // generated text must fail this test rather than pass unnoticed.
    expect(Object.keys(stored ?? {}).toSorted()).toEqual([
      "device",
      "durationMs",
      "itemCount",
      "modelRef",
      "outcome",
      "runId",
      "startedAt",
    ]);
  });

  it("replaces a run written twice under one identifier", async () => {
    await recordInferenceRun(database, run);
    await recordInferenceRun(database, { ...run, durationMs: 99 });

    expect(await database.count(INFERENCE_RUN_STORE)).toBe(1);
    expect((await database.get(INFERENCE_RUN_STORE, run.runId))?.durationMs).toBe(99);
  });

  it("drops the oldest runs once the log passes its cap", async () => {
    for (let index = 0; index <= MAXIMUM_INFERENCE_RUNS; index += 1) {
      await recordInferenceRun(database, { ...run, runId: `run-${index}`, startedAt: index });
    }

    expect(await database.count(INFERENCE_RUN_STORE)).toBe(MAXIMUM_INFERENCE_RUNS);
    expect(await database.get(INFERENCE_RUN_STORE, "run-0")).toBeUndefined();
    expect(await database.get(INFERENCE_RUN_STORE, "run-1")).toBeDefined();
  });
});
