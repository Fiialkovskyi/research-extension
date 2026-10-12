import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { claimNextJob } from ".";
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

describe("claimNextJob", () => {
  it("returns undefined when nothing is queued", async () => {
    expect(await claimNextJob(database, 100)).toBeUndefined();
  });

  it("hands out the highest priority first and marks it running", async () => {
    await database.put(JOB_STORE, job({ id: "low", priority: 1 }));
    await database.put(JOB_STORE, job({ id: "high", priority: 5 }));

    const claimed = await claimNextJob(database, 100);

    expect(claimed).toMatchObject({ id: "high", status: "running" });
    expect(await database.get(JOB_STORE, "high")).toMatchObject({ status: "running" });
    expect(await database.get(JOB_STORE, "low")).toMatchObject({ status: "queued" });
  });

  it("skips a job whose retry is not yet due", async () => {
    await database.put(JOB_STORE, job({ id: "waiting", priority: 5, nextAttemptAt: 500 }));
    await database.put(JOB_STORE, job({ id: "due", priority: 1 }));

    expect((await claimNextJob(database, 100))?.id).toBe("due");
    expect(await claimNextJob(database, 100)).toBeUndefined();
    expect((await claimNextJob(database, 500))?.id).toBe("waiting");
  });

  it("never hands out a job that is not queued", async () => {
    await database.put(JOB_STORE, job({ id: "done", status: "done" }));
    await database.put(JOB_STORE, job({ id: "failed", status: "failed" }));
    await database.put(JOB_STORE, job({ id: "running", status: "running" }));

    expect(await claimNextJob(database, 100)).toBeUndefined();
  });

  it("gives one queued job to only one of two claims made together", async () => {
    await database.put(JOB_STORE, job({ id: "only" }));

    const claims = await Promise.all([claimNextJob(database, 100), claimNextJob(database, 100)]);

    expect(claims.filter((claim) => claim !== undefined)).toHaveLength(1);
  });
});
