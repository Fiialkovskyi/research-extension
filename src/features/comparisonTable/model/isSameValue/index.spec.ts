import { describe, expect, it } from "vitest";

import { isSameValue } from ".";

describe("isSameValue", () => {
  it("agrees on numbers within 5% in one unit", () => {
    expect(isSameValue({ value: "100", unit: "kg" }, { value: "104.9", unit: "kg" })).toBe(true);
  });

  it("disagrees on numbers just over 5% apart", () => {
    expect(isSameValue({ value: "100", unit: "kg" }, { value: "106", unit: "kg" })).toBe(false);
  });

  it("compares across units of one family", () => {
    expect(isSameValue({ value: "23.5", unit: "kg" }, { value: "23 500", unit: "g" })).toBe(true);
    expect(isSameValue({ value: "96", unit: "km" }, { value: "60", unit: "mi" })).toBe(true);
  });

  it("never agrees across different units", () => {
    expect(isSameValue({ value: "500", unit: "Wh" }, { value: "500", unit: "W" })).toBe(false);
    expect(isSameValue({ value: "1749", unit: "USD" }, { value: "1749", unit: "EUR" })).toBe(false);
  });

  it("agrees on text equal after normalisation", () => {
    expect(isSameValue({ value: "Mid-drive" }, { value: "mid drive" })).toBe(true);
    expect(isSameValue({ value: "Hub" }, { value: "Mid-drive" })).toBe(false);
  });

  it("never agrees a number with text", () => {
    expect(isSameValue({ value: "8" }, { value: "eight" })).toBe(false);
  });
});
