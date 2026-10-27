import { describe, expect, it } from "vitest";

import { stripRepeatedUnit } from ".";

describe("stripRepeatedUnit", () => {
  it("takes the unit out of a value that also has one", () => {
    expect(stripRepeatedUnit({ value: "177 г", unit: "г" })).toEqual({ value: "177", unit: "г" });
    expect(stripRepeatedUnit({ value: "42 Мп", unit: "MP" })).toEqual({ value: "42", unit: "MP" });
  });

  it("leaves a value whose unit is only in `unit`", () => {
    expect(stripRepeatedUnit({ value: "5100", unit: "mAh" })).toEqual({
      value: "5100",
      unit: "mAh",
    });
  });

  it("leaves a value that ends in a number, or has no unit", () => {
    expect(stripRepeatedUnit({ value: "Wi-Fi 6", unit: "GHz" })).toEqual({
      value: "Wi-Fi 6",
      unit: "GHz",
    });
    expect(stripRepeatedUnit({ value: "177 г" })).toEqual({ value: "177 г" });
  });

  it("treats an empty unit as none", () => {
    expect(stripRepeatedUnit({ value: "2424 x 1080", unit: "" })).toEqual({ value: "2424 x 1080" });
  });
});
