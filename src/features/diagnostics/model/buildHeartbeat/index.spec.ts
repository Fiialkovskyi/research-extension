import { describe, expect, it } from "vitest";

import { buildHeartbeat } from ".";

const source = {
  runId: "run-1",
  strategy: "apiActivity",
  holdMs: 10_000,
  pageLoadId: "load-1",
} as const;

describe("buildHeartbeat", () => {
  it("records the run, its strategy and hold, the page load and the time", () => {
    expect(buildHeartbeat(source, 4_000, 1_234)).toEqual({
      runId: "run-1",
      strategy: "apiActivity",
      holdMs: 10_000,
      elapsedMs: 4_000,
      pageLoadId: "load-1",
      writtenAt: 1_234,
    });
  });

  it("caps elapsed time at the hold, so a late final beat still reads as complete", () => {
    expect(buildHeartbeat(source, 10_037, 0).elapsedMs).toBe(10_000);
  });

  it("rounds elapsed time to whole milliseconds", () => {
    expect(buildHeartbeat(source, 1_999.6, 0).elapsedMs).toBe(2_000);
  });
});
