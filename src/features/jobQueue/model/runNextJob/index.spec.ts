import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { runNextJob } from ".";
import { JOB_STORE, openResearchDatabase } from "@/shared/storage";

import { enqueueJob } from "../enqueueJob";

beforeEach(async () => {
  const database = await openResearchDatabase();

  await database.clear(JOB_STORE);
});

describe("runNextJob", () => {
  it("reports that there was nothing to run", async () => {
    const database = await openResearchDatabase();

    expect(await runNextJob(database, {})).toBe(false);
  });

  it("runs a job with the runner for its type and marks it done", async () => {
    const database = await openResearchDatabase();
    const job = await enqueueJob(database, {
      type: "embedSnapshot",
      inputHashes: ["a"],
      producerVersion: "1",
    });
    const embed = vi.fn(() => Promise.resolve());
    const other = vi.fn(() => Promise.resolve());

    expect(await runNextJob(database, { embedSnapshot: embed, other })).toBe(true);
    expect(embed).toHaveBeenCalledWith(expect.objectContaining({ id: job.id, status: "running" }));
    expect(other).not.toHaveBeenCalled();
    expect((await database.get(JOB_STORE, job.id))?.status).toBe("done");
  });

  it("fails a job whose runner throws, which the queue retries later", async () => {
    const database = await openResearchDatabase();
    const job = await enqueueJob(database, {
      type: "embedSnapshot",
      inputHashes: ["missing"],
      producerVersion: "1",
    });

    await runNextJob(database, {
      embedSnapshot: () => Promise.reject(new Error("The snapshot no longer exists.")),
    });

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

    await runNextJob(database, {});

    expect((await database.get(JOB_STORE, job.id))?.failureReason).toContain('"summarize"');
  });
});
