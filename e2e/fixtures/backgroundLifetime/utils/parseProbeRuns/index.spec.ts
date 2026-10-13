import { describe, expect, it } from "vitest";

import { parseProbeRuns } from ".";

describe("parseProbeRuns", () => {
  it("parses the runs the page reported", () => {
    const raw = JSON.stringify([{ runId: "a", strategy: "none", state: "stopped", text: "x" }]);

    expect(parseProbeRuns(raw)).toEqual([
      { runId: "a", strategy: "none", state: "stopped", text: "x" },
    ]);
  });

  it("refuses an answer that is not JSON text", () => {
    expect(() => parseProbeRuns(undefined)).toThrow("not JSON text");
  });

  it("refuses a run in a state the card does not show", () => {
    const raw = JSON.stringify([{ runId: "a", strategy: "none", state: "lost", text: "" }]);

    expect(() => parseProbeRuns(raw)).toThrow();
  });
});
