import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { readPendingJobs } from ".";
import { JOB_STORE, openResearchDatabase, type StoredJob } from "@/shared/storage";

/** A stored job with the given status. */
const job = (id: string, status: StoredJob["status"]): StoredJob => ({
  id,
  type: "embed",
  inputHashes: [id],
  producerVersion: "1",
  status,
  priority: 0,
  attempts: 0,
  nextAttemptAt: 0,
  createdAt: 0,
  updatedAt: 0,
});

beforeEach(async () => {
  const database = await openResearchDatabase();

  await database.clear(JOB_STORE);
});

describe("readPendingJobs", () => {
  it("reads queued and running jobs, and leaves done and failed ones out", async () => {
    const database = await openResearchDatabase();

    await Promise.all(
      [job("q", "queued"), job("r", "running"), job("d", "done"), job("f", "failed")].map(
        (stored) => database.put(JOB_STORE, stored),
      ),
    );

    expect((await readPendingJobs(database)).map(({ id }) => id).toSorted()).toEqual(["q", "r"]);
  });
});
