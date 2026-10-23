import { describe, expect, it } from "vitest";

import { parseApproximateSize } from ".";

describe("parseApproximateSize", () => {
  it.each([
    ["274 MB", 274e6],
    ["2.5 GB", 2.5e9],
    ["46 mb", 46e6],
  ])("reads %s", (size, bytes) => {
    expect(parseApproximateSize(size)).toBe(bytes);
  });

  it("reads anything else as nothing", () => {
    expect(parseApproximateSize("about a gigabyte")).toBe(0);
  });
});
