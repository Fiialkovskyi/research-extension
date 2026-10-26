import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { enqueueEntityResolutions } from ".";
import {
  EXTRACTION_STORE,
  JOB_STORE,
  MODEL_STORE,
  openResearchDatabase,
  SESSION_STORE,
  type StoredExtraction,
} from "@/shared/storage";

const extraction = (snapshotId: string, finishedAt?: number): StoredExtraction => ({
  snapshotId,
  sessionId: "session-1",
  nodeId: `node-${snapshotId}`,
  modelRef: "m",
  prompt: "factExtraction@1",
  chunkCount: 1,
  chunkOutcomes: [],
  chunksDone: 1,
  keptCount: 1,
  droppedCount: 0,
  invalidChunkCount: 0,
  ...(finishedAt === undefined ? {} : { finishedAt }),
});

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all(
    ([EXTRACTION_STORE, JOB_STORE, MODEL_STORE, SESSION_STORE] as const).map((store) =>
      database.clear(store),
    ),
  );
  await database.put(SESSION_STORE, {
    id: "session-1",
    title: "Laptops",
    groupId: 1,
    formerGroupIds: [],
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  });
  await database.put(EXTRACTION_STORE, extraction("done", 5));
  await database.put(EXTRACTION_STORE, extraction("underway"));
});

describe("enqueueEntityResolutions", () => {
  it("queues a page once its extraction has finished, naming no embedding model", async () => {
    const jobs = await enqueueEntityResolutions(await openResearchDatabase(), "session-1");

    expect(jobs.map(({ payload }) => payload)).toEqual([{ snapshotId: "done" }]);
    expect(jobs[0]).toMatchObject({
      type: "resolveEntities",
      producerVersion: "entityName@1|none",
    });
  });

  it("names the active embedding model in the job's identity", async () => {
    const database = await openResearchDatabase();

    await database.put(MODEL_STORE, {
      ref: "ollama:nomic@1",
      manifest: { contract: { family: "embedding" } },
      active: true,
      conformance: "passed",
      installedAt: 1,
    } as never);

    const [job] = await enqueueEntityResolutions(database, "session-1");

    expect(job?.producerVersion).toBe("entityName@1|ollama:nomic@1");
  });

  it("queues nothing without an active session, and nothing twice", async () => {
    const database = await openResearchDatabase();

    await enqueueEntityResolutions(database, "session-1");
    await enqueueEntityResolutions(database, "session-1");

    expect(await database.count(JOB_STORE)).toBe(1);

    await database.clear(SESSION_STORE);

    expect(await enqueueEntityResolutions(database, "session-1")).toEqual([]);
  });
});
