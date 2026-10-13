import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { deferJob } from ".";
import { JOB_STORE, openResearchDatabase, type StoredJob } from "@/shared/storage";

const RUNNING: StoredJob = {
  id: "j",
  type: "extractFacts",
  inputHashes: ["a"],
  producerVersion: "1",
  status: "running",
  priority: -10,
  attempts: 2,
  nextAttemptAt: 0,
  checkpoint: { nextChunk: 4 },
  createdAt: 0,
  updatedAt: 0,
};

beforeEach(async () => {
  const database = await openResearchDatabase();

  await database.clear(JOB_STORE);
});

describe("deferJob", () => {
  it("queues the job again, due now, keeping its checkpoint and attempts", async () => {
    const database = await openResearchDatabase();

    await database.put(JOB_STORE, RUNNING);
    await deferJob(database, "j", 500);

    expect(await database.get(JOB_STORE, "j")).toEqual({
      ...RUNNING,
      status: "queued",
      nextAttemptAt: 500,
      updatedAt: 500,
    });
  });

  it("refuses a job that does not exist", async () => {
    const database = await openResearchDatabase();

    await expect(deferJob(database, "missing")).rejects.toThrow('"missing"');
  });
});
