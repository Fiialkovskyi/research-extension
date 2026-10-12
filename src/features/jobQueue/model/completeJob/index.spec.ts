import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { completeJob } from ".";
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

describe("completeJob", () => {
  it("marks the job done and drops its checkpoint", async () => {
    await database.put(JOB_STORE, job({ id: "job-1", status: "running", checkpoint: 3 }));

    await completeJob(database, "job-1");

    const done = await database.get(JOB_STORE, "job-1");

    expect(done).toMatchObject({ status: "done" });
    expect(done).not.toHaveProperty("checkpoint");
  });

  it("names a job that does not exist", async () => {
    await expect(completeJob(database, "missing")).rejects.toThrow(
      'No job is queued under "missing".',
    );
  });
});
