import { describe, expect, it } from "vitest";

import { parseSummariesSnapshot } from ".";

describe("parseSummariesSnapshot", () => {
  it("reads every field the assertions rely on", () => {
    const snapshot = {
      empty: false,
      title: "Summaries: E-bikes",
      needsModel: true,
      tableEmpty: true,
      hasRejected: false,
      questionsNeedModel: true,
      gaps: ["No reviews read yet"],
      clusters: [{ label: "Bikes", hasNoFacts: true, statements: [] }],
    };

    expect(parseSummariesSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("rejects what is not the page's snapshot", () => {
    expect(() => parseSummariesSnapshot(JSON.stringify({ empty: false }))).toThrow();
    expect(() => parseSummariesSnapshot(null)).toThrow(/got object/);
  });
});
