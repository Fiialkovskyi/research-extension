import { describe, expect, it } from "vitest";

import { truncateUtf8Text } from ".";

const getByteLength = (text: string) => new TextEncoder().encode(text).byteLength;

describe("truncateUtf8Text", () => {
  it("keeps text within the limit whole", () => {
    expect(truncateUtf8Text("motors", 6)).toEqual({ text: "motors", truncated: false });
  });

  it("cuts longer text at the limit and says so", () => {
    expect(truncateUtf8Text("mid-drive motors", 9)).toEqual({ text: "mid-drive", truncated: true });
  });

  it("never splits a character that spans several bytes", () => {
    // "ж" is two bytes: a limit of 3 falls inside the second one.
    const { text, truncated } = truncateUtf8Text("жжж", 3);

    expect(text).toBe("ж");
    expect(truncated).toBe(true);
    expect(getByteLength(text)).toBeLessThanOrEqual(3);
  });

  it("measures the limit in bytes, not characters", () => {
    const { text } = truncateUtf8Text("€".repeat(100), 30);

    expect(getByteLength(text)).toBe(30);
  });
});
