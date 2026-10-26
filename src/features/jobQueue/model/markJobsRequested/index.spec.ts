import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { markJobsRequested } from ".";
import { JOB_STORE, openResearchDatabase, type StoredJob } from "@/shared/storage";

const QUEUED: StoredJob = {
  id: "j",
  type: "extractFacts",
  inputHashes: ["a"],
  producerVersion: "1",
  status: "queued",
  priority: -10,
  attempts: 0,
  nextAttemptAt: 0,
  payload: { sessionId: "s" },
  createdAt: 0,
  updatedAt: 0,
};

beforeEach(async () => {
  const database = await openResearchDatabase();

  await database.clear(JOB_STORE);
});

describe("markJobsRequested", () => {
  it("adds the request time to the payload of each job, keeping the rest of it", async () => {
    const database = await openResearchDatabase();

    await database.put(JOB_STORE, QUEUED);
    await markJobsRequested(database, ["j"], 700);

    expect((await database.get(JOB_STORE, "j"))?.payload).toEqual({
      sessionId: "s",
      requestedAt: 700,
    });
  });

  it("leaves a job it was not given alone and skips one that does not exist", async () => {
    const database = await openResearchDatabase();

    await database.put(JOB_STORE, QUEUED);
    await database.put(JOB_STORE, { ...QUEUED, id: "other" });
    await markJobsRequested(database, ["missing", "j"], 700);

    expect((await database.get(JOB_STORE, "other"))?.payload).toEqual({ sessionId: "s" });
    expect(await database.count(JOB_STORE)).toBe(2);
  });
});
