import { describe, expect, it } from "vitest";

import { readProbeOutcome } from ".";
import type { StoredHeartbeat } from "@/shared/storage";

/** A beat of run-1 (hold 10 s), written at `writtenAt` by `pageLoadId`. */
const beat = (elapsedMs: number, writtenAt: number, pageLoadId = "load-1"): StoredHeartbeat => ({
  runId: "run-1",
  strategy: "none",
  holdMs: 10_000,
  elapsedMs,
  pageLoadId,
  writtenAt,
});

describe("readProbeOutcome", () => {
  it("reads nothing from a run with no beats", () => {
    expect(readProbeOutcome([], 0)).toBeUndefined();
  });

  it("reads a run that held its whole hold in one page load as completed", () => {
    const beats = [0, 2_000, 4_000, 6_000, 8_000, 10_000].map((t) => beat(t, 100 + t));

    expect(readProbeOutcome(beats, 60_000)).toMatchObject({
      state: "completed",
      lastSeenMs: 10_000,
      longestGapMs: 2_000,
      pageLoads: 1,
      startedAt: 100,
    });
  });

  it("reads a run whose page went silent as stopped, with how far it got", () => {
    const beats = [0, 2_000, 4_000].map((t) => beat(t, t));

    expect(readProbeOutcome(beats, 30_000)).toMatchObject({
      state: "stopped",
      lastSeenMs: 4_000,
    });
  });

  it("reads a run that beat a moment ago as still running", () => {
    const beats = [0, 2_000].map((t) => beat(t, t));

    expect(readProbeOutcome(beats, 3_000)).toMatchObject({ state: "running" });
  });

  it("reads a run finished by a second page load as resumed, with the gap of the unload", () => {
    const beats = [
      beat(0, 0),
      beat(2_000, 2_000),
      // Unloaded here; the alarm woke a new page 61 s later.
      beat(2_000, 63_000, "load-2"),
      beat(4_000, 65_000, "load-2"),
      beat(10_000, 71_000, "load-2"),
    ];

    expect(readProbeOutcome(beats, 80_000)).toMatchObject({
      state: "resumed",
      pageLoads: 2,
      longestGapMs: 61_000,
    });
  });

  it("orders beats by when they were written, not as stored", () => {
    const beats = [beat(10_000, 10_000), beat(0, 0), beat(5_000, 5_000)];

    expect(readProbeOutcome(beats, 10_500)).toMatchObject({
      state: "completed",
      longestGapMs: 5_000,
    });
  });
});
