import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { runNextEmbeddingJob } from ".";
import { enqueueJob } from "@/features/jobQueue";
import { JOB_STORE, openResearchDatabase } from "@/shared/storage";

beforeEach(async () => {
  const database = await openResearchDatabase();

  await database.clear(JOB_STORE);
});

describe("runNextEmbeddingJob", () => {
  it("reports that there was nothing to run", async () => {
    const database = await openResearchDatabase();

    expect(await runNextEmbeddingJob(database, vi.fn())).toBe(false);
  });

  it("fails a job it cannot run, which the queue retries later", async () => {
    const database = await openResearchDatabase();
    const job = await enqueueJob(database, {
      type: "embedSnapshot",
      inputHashes: ["missing"],
      producerVersion: "space",
      payload: { snapshotId: "missing", spaceId: "space" },
    });

    expect(await runNextEmbeddingJob(database, vi.fn())).toBe(true);
    expect(await database.get(JOB_STORE, job.id)).toMatchObject({
      status: "queued",
      attempts: 1,
      failureReason: expect.stringContaining("no longer exists"),
    });
  });

  it("fails a job of a type it has no runner for", async () => {
    const database = await openResearchDatabase();
    const job = await enqueueJob(database, {
      type: "summarize",
      inputHashes: ["a"],
      producerVersion: "1",
    });

    await runNextEmbeddingJob(database, vi.fn());

    expect((await database.get(JOB_STORE, job.id))?.failureReason).toContain('"summarize"');
  });
});
