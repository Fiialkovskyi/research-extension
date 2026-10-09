import { describe, expect, it } from "vitest";

import { parseTabGroupsSnapshot } from ".";

describe("parseTabGroupsSnapshot", () => {
  it("parses the groups the browser reported", () => {
    const raw = JSON.stringify([{ label: "Motors", color: "blue", tabCount: 1 }]);

    expect(parseTabGroupsSnapshot(raw)).toEqual([{ label: "Motors", color: "blue", tabCount: 1 }]);
  });

  it("rejects a value that is not a JSON string", () => {
    expect(() => parseTabGroupsSnapshot([])).toThrow(/JSON string/);
  });

  it("rejects a group missing its tab count", () => {
    expect(() => parseTabGroupsSnapshot(JSON.stringify([{ label: "x", color: "blue" }]))).toThrow();
  });
});
