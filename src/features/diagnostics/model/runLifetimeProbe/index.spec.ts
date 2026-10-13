import { describe, expect, it, vi } from "vitest";

import { runLifetimeProbe, type RunLifetimeProbeOptions } from ".";
import type { StoredHeartbeat, StoredJob } from "@/shared/storage";

import { LIFETIME_PROBE_JOB } from "../../constants";
import type { LifetimeStrategy, ProbeCheckpoint } from "../../types";

/** A claimed probe job for a 5 s hold. */
const probeJob = (strategy: LifetimeStrategy, checkpoint?: ProbeCheckpoint): StoredJob => ({
  id: "job-1",
  type: LIFETIME_PROBE_JOB,
  inputHashes: ["run-1"],
  producerVersion: "probe@1",
  status: "running",
  priority: 0,
  attempts: 0,
  nextAttemptAt: 0,
  createdAt: 0,
  updatedAt: 0,
  payload: { runId: "run-1", strategy, holdMs: 5_000 },
  ...(checkpoint === undefined ? {} : { checkpoint }),
});

/** Runs a probe on a virtual clock that `sleep` advances. */
const runOnClock = async (job: StoredJob, holdFor: RunLifetimeProbeOptions["holdFor"]) => {
  let clock = 100_000;
  const beats: StoredHeartbeat[] = [];
  const checkpoints: ProbeCheckpoint[] = [];

  await runLifetimeProbe({
    job,
    pageLoadId: "load-2",
    now: () => clock,
    sleep: (ms) => {
      clock += ms;
      return Promise.resolve();
    },
    writeHeartbeat: (beat) => {
      beats.push(beat);
      return Promise.resolve();
    },
    saveCheckpoint: (checkpoint) => {
      checkpoints.push(checkpoint);
      return Promise.resolve();
    },
    holdFor,
  });

  return { beats, checkpoints };
};

describe("runLifetimeProbe", () => {
  it("beats every 2 s until the hold is reached, checkpointing each beat", async () => {
    const { beats, checkpoints } = await runOnClock(probeJob("none"), () => undefined);

    expect(beats.map(({ elapsedMs }) => elapsedMs)).toEqual([0, 2_000, 4_000, 5_000]);
    expect(beats.every(({ pageLoadId }) => pageLoadId === "load-2")).toBe(true);
    expect(checkpoints.at(-1)).toEqual({ elapsedMs: 5_000, pageLoadId: "load-2" });
  });

  it("holds the background for its strategy, and releases the hold when done", async () => {
    const release = vi.fn();
    const holdFor = vi.fn(() => release);

    await runOnClock(probeJob("apiActivity"), holdFor);

    expect(holdFor).toHaveBeenCalledWith("apiActivity");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("releases the hold when writing a beat fails", async () => {
    const release = vi.fn();

    await expect(
      runLifetimeProbe({
        job: probeJob("hostPage"),
        pageLoadId: "load-1",
        now: () => 0,
        sleep: () => Promise.resolve(),
        writeHeartbeat: () => Promise.reject(new Error("disk full")),
        saveCheckpoint: () => Promise.resolve(),
        holdFor: () => release,
      }),
    ).rejects.toThrow("disk full");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("resumes a wake-and-resume run from its checkpoint after an unload", async () => {
    const job = probeJob("wakeAndResume", { elapsedMs: 2_000, pageLoadId: "load-1" });
    const { beats } = await runOnClock(job, () => undefined);

    expect(beats.map(({ elapsedMs }) => elapsedMs)).toEqual([2_000, 4_000, 5_000]);
  });

  it("ends any other strategy's run where the unload stopped it", async () => {
    const holdFor = vi.fn(() => undefined);
    const job = probeJob("apiActivity", { elapsedMs: 2_000, pageLoadId: "load-1" });
    const { beats } = await runOnClock(job, holdFor);

    expect(beats).toEqual([]);
    expect(holdFor).not.toHaveBeenCalled();
  });

  it("refuses a job that is not a probe's", async () => {
    const job = { ...probeJob("none"), payload: { snapshotId: "s" } };

    await expect(runOnClock(job, () => undefined)).rejects.toThrow();
  });
});
