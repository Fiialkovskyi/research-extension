import { describe, expect, it } from "vitest";

import { getNextWakeTime } from ".";
import type { StoredJob } from "@/shared/storage";

import { JOB_WAKE_DELAY_MS } from "../../constants";

const NOW = 1_000_000;

/** A stored job with the given status, due at `nextAttemptAt`. */
const job = (status: StoredJob["status"], nextAttemptAt = 0): StoredJob => ({
  id: `${status}-${nextAttemptAt}`,
  type: "embed",
  inputHashes: [],
  producerVersion: "1",
  status,
  priority: 0,
  attempts: 0,
  nextAttemptAt,
  createdAt: 0,
  updatedAt: 0,
});

describe("getNextWakeTime", () => {
  it("schedules nothing when there are no jobs", () => {
    expect(getNextWakeTime([], NOW)).toBeUndefined();
  });

  it("wakes no sooner than the minimum delay for a job that is already due", () => {
    expect(getNextWakeTime([job("queued", NOW - 5)], NOW)).toBe(NOW + JOB_WAKE_DELAY_MS);
  });

  it("waits for a retry two minutes out rather than waking early", () => {
    expect(getNextWakeTime([job("queued", NOW + 120_000)], NOW)).toBe(NOW + 120_000);
  });

  it("takes the earliest of several queued jobs", () => {
    const jobs = [job("queued", NOW + 300_000), job("queued", NOW + 90_000)];

    expect(getNextWakeTime(jobs, NOW)).toBe(NOW + 90_000);
  });

  it("wakes within the minimum delay while a job runs, to recover it after an unload", () => {
    const jobs = [job("running"), job("queued", NOW + 600_000)];

    expect(getNextWakeTime(jobs, NOW)).toBe(NOW + JOB_WAKE_DELAY_MS);
  });

  it("schedules nothing for jobs that are done or failed for good", () => {
    expect(getNextWakeTime([job("done"), job("failed")], NOW)).toBeUndefined();
  });
});
