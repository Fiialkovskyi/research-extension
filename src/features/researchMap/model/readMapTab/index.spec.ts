import { describe, expect, it } from "vitest";

import { readMapTab } from ".";

describe("readMapTab", () => {
  it("keeps what opening the map reads and drops the rest", () => {
    expect(
      readMapTab({ id: 4, windowId: 2, url: "moz-extension://uuid/map.html", groupId: 42 }),
    ).toEqual({ id: 4, windowId: 2, url: "moz-extension://uuid/map.html", groupId: 42 });
  });

  it("reads a tab without a group as in none, and leaves an unknown URL absent", () => {
    expect(readMapTab({ id: 4, windowId: 2 })).toEqual({ id: 4, windowId: 2, groupId: -1 });
  });

  it("refuses a tab without an id", () => {
    expect(() => readMapTab({ windowId: 2 })).toThrow("without an id");
  });
});
