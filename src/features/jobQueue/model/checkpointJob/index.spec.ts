import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { checkpointJob } from ".";
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

describe("checkpointJob", () => {
  it("records progress on a running job", async () => {
    await database.put(JOB_STORE, job({ id: "job-1", status: "running" }));

    await checkpointJob(database, "job-1", { chunk: 12 });

    expect(await database.get(JOB_STORE, "job-1")).toMatchObject({ checkpoint: { chunk: 12 } });
  });

  it("refuses a checkpoint for a job that is no longer running", async () => {
    await database.put(JOB_STORE, job({ id: "job-1", status: "queued" }));

    await expect(checkpointJob(database, "job-1", {})).rejects.toThrow(/is not running/);
  });

  it("refuses a checkpoint for a job that does not exist", async () => {
    await expect(checkpointJob(database, "missing", {})).rejects.toThrow(
      /"missing" is not running/,
    );
  });
});
