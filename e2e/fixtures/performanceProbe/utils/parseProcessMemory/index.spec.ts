import { describe, expect, it } from "vitest";

import { parseProcessMemory } from ".";

describe("parseProcessMemory", () => {
  it("sums the extension processes' memory", () => {
    expect(
      parseProcessMemory(
        JSON.stringify([
          { type: "extension", memory: 60 },
          { type: "web", memory: 500 },
        ]),
      ),
    ).toBe(60);
  });

  it("refuses a list with no extension process, or no list", () => {
    expect(() => parseProcessMemory('[{"type":"web","memory":1}]')).toThrow("No extension");
    expect(() => parseProcessMemory(1)).toThrow("JSON string");
  });
});
