import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { readJobActivity } from ".";
import { JOB_STORE, openResearchDatabase, type StoredJob } from "@/shared/storage";

const NOW = 10_000;

/** A stored job, queued and due, entered at time 1000 unless told otherwise. */
const job = (overrides: Partial<StoredJob> & { id: string }): StoredJob => ({
  type: "embedSnapshot",
  inputHashes: [overrides.id],
  producerVersion: "1",
  status: "queued",
  priority: 0,
  attempts: 0,
  nextAttemptAt: 0,
  createdAt: 1_000,
  queuedAt: 1_000,
  updatedAt: 1_000,
  ...overrides,
});

const seed = async (...jobs: StoredJob[]) => {
  const database = await openResearchDatabase();

  for (const stored of jobs) {
    await database.put(JOB_STORE, stored);
  }

  return database;
};

beforeEach(async () => {
  const database = await openResearchDatabase();

  await database.clear(JOB_STORE);
});

describe("readJobActivity", () => {
  it("reports no batch when nothing is pending", async () => {
    const database = await seed(job({ id: "a", status: "done", updatedAt: 5_000 }));

    expect(await readJobActivity(database, { now: NOW })).toEqual({
      running: [],
      queued: [],
      sessionDoneByType: {},
      sessionFailedTypes: [],
    });
  });

  it("counts a batch under way: the running job, the queue and what settled since it began", async () => {
    const database = await seed(
      job({ id: "old", status: "done", updatedAt: 500 }),
      job({ id: "d1", status: "done", updatedAt: 2_000 }),
      job({ id: "d2", status: "done", updatedAt: 3_000 }),
      job({ id: "f1", status: "failed", type: "extractFacts", updatedAt: 4_000 }),
      job({ id: "r", status: "running", type: "extractFacts", updatedAt: 9_000 }),
      job({ id: "q1" }),
      job({ id: "q2", priority: 5, type: "summarizeCluster" }),
    );

    const activity = await readJobActivity(database, { now: NOW });

    expect(activity.running).toEqual([{ type: "extractFacts", startedAt: 9_000 }]);
    expect(activity.queued.map((queued) => queued.type)).toEqual([
      "summarizeCluster",
      "embedSnapshot",
    ]);
    expect(activity.batch).toEqual({
      startedAt: 1_000,
      settledTypes: expect.arrayContaining(["embedSnapshot", "embedSnapshot", "extractFacts"]),
      failedTypes: ["extractFacts"],
    });
    expect(activity.batch?.settledTypes).toHaveLength(3);
  });

  it("grows the batch with work enqueued before it empties", async () => {
    const database = await seed(
      job({ id: "d1", status: "done", updatedAt: 2_000 }),
      job({ id: "d2", status: "done", updatedAt: 3_000 }),
      job({ id: "q1" }),
      job({ id: "q2" }),
    );

    const before = await readJobActivity(database, { now: NOW });

    expect(before.batch?.settledTypes.length).toBe(2);
    expect(before.queued.length).toBe(2);

    for (const id of ["n1", "n2", "n3"]) {
      await database.put(JOB_STORE, job({ id, createdAt: 8_000, queuedAt: 8_000 }));
    }

    const after = await readJobActivity(database, { now: NOW });

    expect(after.batch?.settledTypes.length).toBe(2);
    expect(after.queued.length).toBe(5);
  });

  it("starts the batch when a failed job was asked for again, not when it was first created", async () => {
    const database = await seed(
      job({ id: "long-ago", status: "done", updatedAt: 200 }),
      job({ id: "retry", createdAt: 100, queuedAt: 8_000, updatedAt: 8_000 }),
    );

    const activity = await readJobActivity(database, { now: NOW });

    expect(activity.batch).toEqual({ startedAt: 8_000, settledTypes: [], failedTypes: [] });
  });

  it("falls back to when a job was created for jobs that never recorded entering the queue", async () => {
    const { queuedAt: _absent, ...legacy } = job({ id: "legacy", createdAt: 700 });
    const database = await seed(legacy);

    expect((await readJobActivity(database, { now: NOW })).batch?.startedAt).toBe(700);
  });

  it("leaves out a first attempt held back to debounce, but keeps a retry waiting out its backoff", async () => {
    const database = await seed(
      job({ id: "debounced", nextAttemptAt: NOW + 5_000 }),
      job({ id: "retrying", attempts: 1, nextAttemptAt: NOW + 30_000 }),
    );

    const activity = await readJobActivity(database, { now: NOW });

    expect(activity.queued).toEqual([{ type: "embedSnapshot", isPermitted: true }]);
    expect(activity.batch).toBeDefined();
  });

  it("asks the caller whether each queued job may run now", async () => {
    const database = await seed(job({ id: "embed" }), job({ id: "facts", type: "extractFacts" }));

    const activity = await readJobActivity(database, {
      now: NOW,
      isPermitted: (queued) => queued.type !== "extractFacts",
    });

    expect(activity.queued).toEqual(
      expect.arrayContaining([
        { type: "embedSnapshot", isPermitted: true },
        { type: "extractFacts", isPermitted: false },
      ]),
    );
  });

  it("counts the session's finished work once per piece, across producer versions", async () => {
    const database = await seed(
      job({
        id: "p1-v1",
        inputHashes: ["p1"],
        producerVersion: "1",
        status: "done",
        sessionId: "s",
      }),
      job({
        id: "p1-v2",
        inputHashes: ["p1"],
        producerVersion: "2",
        status: "done",
        sessionId: "s",
      }),
      job({ id: "p2", inputHashes: ["p2"], status: "done", sessionId: "s" }),
      job({ id: "f", type: "extractFacts", status: "done", sessionId: "s" }),
      job({ id: "other", status: "done", sessionId: "other" }),
    );

    const activity = await readJobActivity(database, { now: NOW, sessionId: "s" });

    expect(activity.sessionDoneByType).toEqual({ embedSnapshot: 2, extractFacts: 1 });
  });

  it("counts the session's failed work only while it has not been done since", async () => {
    const database = await seed(
      job({
        id: "f-v1",
        inputHashes: ["p1"],
        producerVersion: "1",
        status: "failed",
        sessionId: "s",
      }),
      job({
        id: "d-v2",
        inputHashes: ["p1"],
        producerVersion: "2",
        status: "done",
        sessionId: "s",
      }),
      job({
        id: "f2",
        inputHashes: ["p2"],
        type: "extractFacts",
        status: "failed",
        sessionId: "s",
      }),
    );

    const activity = await readJobActivity(database, { now: NOW, sessionId: "s" });

    expect(activity.sessionFailedTypes).toEqual(["extractFacts"]);
  });
});
