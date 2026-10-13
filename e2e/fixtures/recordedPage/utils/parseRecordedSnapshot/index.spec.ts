import { describe, expect, it } from "vitest";

import { parseRecordedSnapshot } from ".";

describe("parseRecordedSnapshot", () => {
  it("reads every field the assertions rely on", () => {
    const snapshot = {
      empty: false,
      title: "What was recorded: Motors",
      canExtractFacts: true,
      entitiesEmpty: false,
      entries: [
        {
          nodeId: "a",
          heading: "Mid-drive motors",
          scroll: "80%",
          copies: "1",
          snapshot: "12.0 KB",
          vectors: "0",
          facts: "7 kept, 2 dropped",
          text: null,
        },
      ],
    };

    expect(parseRecordedSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("rejects what is not the page's snapshot", () => {
    expect(() => parseRecordedSnapshot(JSON.stringify({ empty: false }))).toThrow();
    expect(() => parseRecordedSnapshot(null)).toThrow(/got object/);
  });
});
