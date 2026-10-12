import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { failJob } from ".";
import { JOB_RETRY_LIMIT } from "../../constants";
import {
  JOB_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  type StoredJob,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(JOB_STORE);
});

/** A stored job, queued and due at time 0 unless told otherwise. */
const job = (overrides: Partial<StoredJob> & { id: string }): StoredJob => ({
  type: "embed",
  inputHashes: ["a"],
  producerVersion: "model@1",
  status: "queued",
  priority: 0,
  attempts: 0,
  nextAttemptAt: 0,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

describe("failJob", () => {
  it("retries after 30, 60 and 120 seconds, keeping the checkpoint", async () => {
    await database.put(JOB_STORE, job({ id: "job-1", status: "running", checkpoint: 4 }));

    const delays: number[] = [];

    for (let attempt = 1; attempt <= JOB_RETRY_LIMIT; attempt += 1) {
      const failed = await failJob(database, "job-1", "timeout", 1000);

      expect(failed).toMatchObject({ status: "queued", attempts: attempt, checkpoint: 4 });
      delays.push(failed.nextAttemptAt - 1000);
    }

    expect(delays).toEqual([30_000, 60_000, 120_000]);
  });

  it("leaves the job failed with the reason after the fourth failure", async () => {
    await database.put(
      JOB_STORE,
      job({ id: "job-1", status: "running", attempts: JOB_RETRY_LIMIT }),
    );

    const failed = await failJob(database, "job-1", "out of memory", 1000);

    expect(failed).toMatchObject({
      status: "failed",
      attempts: JOB_RETRY_LIMIT + 1,
      failureReason: "out of memory",
    });
    expect(await database.get(JOB_STORE, "job-1")).toEqual(failed);
  });

  it("names a job that does not exist", async () => {
    await expect(failJob(database, "missing", "x")).rejects.toThrow(
      'No job is queued under "missing".',
    );
  });
});
