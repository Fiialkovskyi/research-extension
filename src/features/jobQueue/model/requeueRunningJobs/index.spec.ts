import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { requeueRunningJobs } from ".";
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

describe("requeueRunningJobs", () => {
  it("puts interrupted jobs back, due now, with checkpoint and attempts kept", async () => {
    await database.put(
      JOB_STORE,
      job({ id: "interrupted", status: "running", attempts: 1, checkpoint: { chunk: 9 } }),
    );

    expect(await requeueRunningJobs(database, 700)).toBe(1);
    expect(await database.get(JOB_STORE, "interrupted")).toMatchObject({
      status: "queued",
      nextAttemptAt: 700,
      attempts: 1,
      checkpoint: { chunk: 9 },
    });
  });

  it("leaves jobs that are not running alone", async () => {
    const untouched = [
      job({ id: "queued", nextAttemptAt: 5000 }),
      job({ id: "done", status: "done" }),
      job({ id: "failed", status: "failed" }),
    ];

    await Promise.all(untouched.map((stored) => database.put(JOB_STORE, stored)));

    expect(await requeueRunningJobs(database, 700)).toBe(0);
    expect((await database.getAll(JOB_STORE)).toSorted((a, b) => a.id.localeCompare(b.id))).toEqual(
      untouched.toSorted((a, b) => a.id.localeCompare(b.id)),
    );
  });
});
