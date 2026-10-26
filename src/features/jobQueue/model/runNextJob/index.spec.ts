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

  it("hands a deferred job back, due now, with its checkpoint and attempts", async () => {
    const database = await openResearchDatabase();
    const job = await enqueueJob(database, {
      type: "extractFacts",
      inputHashes: ["a"],
      producerVersion: "1",
    });

    await database.put(JOB_STORE, { ...job, attempts: 1, checkpoint: { nextChunk: 3 } });
    await runNextJob(database, { extractFacts: () => Promise.resolve("deferred" as const) });

    expect(await database.get(JOB_STORE, job.id)).toMatchObject({
      status: "queued",
      attempts: 1,
      checkpoint: { nextChunk: 3 },
    });
  });

  it("claims only permitted jobs", async () => {
    const database = await openResearchDatabase();

    await enqueueJob(database, { type: "extractFacts", inputHashes: ["a"], producerVersion: "1" });

    expect(
      await runNextJob(database, {}, { isPermitted: ({ type }) => type !== "extractFacts" }),
    ).toBe(false);
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

  it("reports the claimed job before its runner starts", async () => {
    const database = await openResearchDatabase();
    const job = await enqueueJob(database, {
      type: "embedSnapshot",
      inputHashes: ["a"],
      producerVersion: "1",
    });
    const order: string[] = [];
    const onClaimed = vi.fn(() => order.push("claimed"));

    await runNextJob(
      database,
      {
        embedSnapshot: () => {
          order.push("ran");
          return Promise.resolve();
        },
      },
      { onClaimed },
    );

    expect(onClaimed).toHaveBeenCalledOnce();
    expect(onClaimed).toHaveBeenCalledWith(
      expect.objectContaining({ id: job.id, status: "running" }),
    );
    expect(order).toEqual(["claimed", "ran"]);
  });
});
