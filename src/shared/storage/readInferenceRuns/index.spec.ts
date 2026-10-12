import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { readInferenceRuns } from ".";
import { INFERENCE_RUN_STORE } from "../constants";
import { type ResearchDatabaseSchema, type StoredInferenceRun } from "../types";
import { openResearchDatabase } from "../openResearchDatabase";
import { recordInferenceRun } from "../recordInferenceRun";

const baseRun: StoredInferenceRun = {
  runId: "run-1",
  modelRef: "owner/first@" + "a".repeat(40),
  device: "wasm",
  durationMs: 10,
  outcome: "ok",
  itemCount: 1,
  startedAt: 1_000,
};

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(INFERENCE_RUN_STORE);
});

describe("readInferenceRuns", () => {
  it("returns nothing when no run has been recorded", async () => {
    expect(await readInferenceRuns(database)).toEqual([]);
  });

  it("returns runs newest first", async () => {
    await recordInferenceRun(database, { ...baseRun, runId: "older", startedAt: 1_000 });
    await recordInferenceRun(database, { ...baseRun, runId: "newest", startedAt: 3_000 });
    await recordInferenceRun(database, { ...baseRun, runId: "middle", startedAt: 2_000 });

    expect((await readInferenceRuns(database)).map((run) => run.runId)).toEqual([
      "newest",
      "middle",
      "older",
    ]);
  });

  it("narrows to one model when asked", async () => {
    const otherRef = "owner/second@" + "b".repeat(40);

    await recordInferenceRun(database, { ...baseRun, runId: "first-model" });
    await recordInferenceRun(database, { ...baseRun, runId: "other-model", modelRef: otherRef });

    const runs = await readInferenceRuns(database, otherRef);

    expect(runs.map((run) => run.runId)).toEqual(["other-model"]);
  });

  it("returns nothing for a model with no runs", async () => {
    await recordInferenceRun(database, baseRun);

    expect(await readInferenceRuns(database, "owner/absent@" + "c".repeat(40))).toEqual([]);
  });

  it("returns only the newest runs when given a limit", async () => {
    for (const startedAt of [1_000, 2_000, 3_000]) {
      await recordInferenceRun(database, { ...baseRun, runId: `run-${startedAt}`, startedAt });
    }

    const runs = await readInferenceRuns(database, undefined, 2);

    expect(runs.map((run) => run.runId)).toEqual(["run-3000", "run-2000"]);
  });
});
