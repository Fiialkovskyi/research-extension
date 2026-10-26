import { describe, expect, it } from "vitest";

import { getActivityState } from ".";
import type { JobActivity } from "@/features/jobQueue";

/** An idle queue with no session totals, changed as each case needs. */
const activity = (overrides: Partial<JobActivity> = {}): JobActivity => ({
  running: [],
  queued: [],
  sessionDoneByType: {},
  sessionFailedTypes: [],
  ...overrides,
});

const batch = (settledTypes: string[], failedTypes: string[] = []) => ({
  startedAt: 0,
  settledTypes,
  failedTypes,
});

const queued = (type: string, isPermitted = true) => ({ type, isPermitted });

describe("getActivityState", () => {
  it("is ready when nothing is pending", () => {
    expect(getActivityState(activity(), { isPaused: false })).toEqual({
      kind: "ready",
      totals: {},
      failed: 0,
    });
  });

  it("reports the session's totals when ready, leaving out kinds with nothing finished", () => {
    const state = getActivityState(
      activity({
        sessionDoneByType: { embedSnapshot: 14, extractFacts: 12, resolveEntities: 3 },
        sessionFailedTypes: ["extractFacts", "extractFacts", "diagnostics.lifetimeProbe"],
      }),
      { isPaused: false },
    );

    expect(state).toEqual({ kind: "ready", totals: { pagesRead: 14, factsFrom: 12 }, failed: 2 });
  });

  it("names the running work and how far the batch has got", () => {
    const state = getActivityState(
      activity({
        running: [{ type: "extractFacts", startedAt: 500 }],
        queued: Array.from({ length: 8 }, () => queued("extractFacts")),
        batch: batch(["embedSnapshot", "embedSnapshot", "extractFacts"]),
      }),
      { isPaused: false },
    );

    expect(state).toEqual({
      kind: "working",
      label: "Extracting facts",
      settled: 3,
      total: 12,
      startedAt: 500,
      failed: 0,
    });
  });

  it("counts failures inside the batch while it lasts", () => {
    const state = getActivityState(
      activity({
        running: [{ type: "embedSnapshot", startedAt: 0 }],
        batch: batch(["embedSnapshot", "extractFacts"], ["extractFacts"]),
      }),
      { isPaused: false },
    );

    expect(state).toMatchObject({ kind: "working", settled: 2, total: 3, failed: 1 });
  });

  it("is paused over working when the local server stopped answering", () => {
    const state = getActivityState(
      activity({
        running: [{ type: "embedSnapshot", startedAt: 0 }],
        queued: [queued("embedSnapshot"), queued("extractFacts", false)],
      }),
      { isPaused: true },
    );

    expect(state).toEqual({ kind: "paused", waiting: 3, failed: 0 });
  });

  it("is ready, not paused, when the server is down but nothing is pending", () => {
    expect(getActivityState(activity(), { isPaused: true }).kind).toBe("ready");
  });

  it("waits for the user when every pending job is held back", () => {
    const state = getActivityState(
      activity({
        queued: [queued("summarizeCluster", false), queued("extractFacts", false)],
        batch: batch([]),
      }),
      { isPaused: false },
    );

    expect(state).toEqual({ kind: "waiting", waiting: 2, failed: 0 });
  });

  it("works, naming the next job, when nothing runs but a job may", () => {
    const state = getActivityState(
      activity({ queued: [queued("summarizeCluster", false), queued("embedSnapshot")] }),
      { isPaused: false },
    );

    expect(state).toEqual({
      kind: "working",
      label: "Reading pages",
      settled: 0,
      total: 2,
      failed: 0,
    });
  });

  it("leaves work the user would not recognize out of every count", () => {
    const probe = "diagnostics.lifetimeProbe";

    expect(
      getActivityState(
        activity({
          running: [{ type: probe, startedAt: 0 }],
          queued: [queued(probe)],
          batch: batch([probe], [probe]),
        }),
        { isPaused: false },
      ),
    ).toEqual({ kind: "ready", totals: {}, failed: 0 });
  });
});
