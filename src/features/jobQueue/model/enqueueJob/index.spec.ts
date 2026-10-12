import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { enqueueJob } from ".";
import { buildJobId } from "../buildJobId";
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

const work = { type: "embed", inputHashes: ["b", "a"], producerVersion: "model@1" };

describe("enqueueJob", () => {
  it("queues new work, due now, keyed by what it does", async () => {
    const queued = await enqueueJob(database, { ...work, sessionId: "session-1", priority: 2 });

    expect(queued).toMatchObject({
      id: await buildJobId(work),
      status: "queued",
      priority: 2,
      attempts: 0,
      sessionId: "session-1",
      inputHashes: ["a", "b"],
    });
    expect(await database.get(JOB_STORE, queued.id)).toEqual(queued);
  });

  it.each(["queued", "running", "done"] as const)(
    "skips work whose job is already %s",
    async (status) => {
      const id = await buildJobId(work);
      const existing = job({ id, status, checkpoint: { chunk: 3 } });
      await database.put(JOB_STORE, existing);

      expect(await enqueueJob(database, work)).toEqual(existing);
      expect(await database.count(JOB_STORE)).toBe(1);
    },
  );

  it("queues a failed job again, attempts reset and checkpoint kept", async () => {
    const id = await buildJobId(work);
    await database.put(
      JOB_STORE,
      job({ id, status: "failed", attempts: 4, failureReason: "out of memory", checkpoint: 7 }),
    );

    const queued = await enqueueJob(database, work);

    expect(queued).toMatchObject({ status: "queued", attempts: 0, checkpoint: 7 });
    expect(queued).not.toHaveProperty("failureReason");
  });
});
