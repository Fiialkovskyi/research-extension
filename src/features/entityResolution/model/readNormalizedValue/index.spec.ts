import { describe, expect, it } from "vitest";

import { readNormalizedValue } from ".";

describe("readNormalizedValue", () => {
  it.each([
    ["1200", "g", 1.2, "kg"],
    ["1,2", "кг", 1.2, "kg"],
    ["3", "lb", 1.360_777_11, "kg"],
    ["13", "inch", 330.2, "mm"],
    ["13.6", '"', 345.44, "mm"],
    ["30", "см", 300, "mm"],
    ["96", "km", 96, "km"],
    ["60", "mi", 96.560_64, "km"],
    ["500", "Wh", 500, "Wh"],
    ["0.5", "kWh", 500, "Wh"],
    ["4500", "mAh", 4500, "mAh"],
    ["250", "W", 250, "W"],
    ["85", "N·m", 85, "N·m"],
    ["85", "Нм", 85, "N·m"],
    ["90", "min", 5400, "s"],
    ["512", "GB", 512, "GB"],
    ["1", "TB", 1000, "GB"],
  ])("reads %s %s as %s %s", (value, unit, number, base) => {
    expect(readNormalizedValue(value, unit)).toEqual({ number, unit: base });
  });

  it.each([
    ["1,200", 1200],
    ["1 200", 1200],
    ["1.234,5", 1234.5],
    ["1,234.5", 1234.5],
    ["2,5", 2.5],
    ["1.200.000", 1_200_000],
  ])("reads the separators of %s", (value, number) => {
    expect(readNormalizedValue(value, "kg")?.number).toBe(number);
  });

  it("keeps a percentage, a currency and an unknown unit as written", () => {
    expect(readNormalizedValue("15", "%")).toEqual({ number: 15, unit: "%" });
    expect(readNormalizedValue("49 999", "uah")).toEqual({ number: 49_999, unit: "UAH" });
    expect(readNormalizedValue("8", "cores")).toEqual({ number: 8, unit: "cores" });
  });

  it("reads a bare number with no unit", () => {
    expect(readNormalizedValue("8", undefined)).toEqual({ number: 8, unit: "" });
  });

  it("gives no normalised form for a value that is not a number", () => {
    expect(readNormalizedValue("Blush", undefined)).toBeUndefined();
    expect(readNormalizedValue("A18 Pro", undefined)).toBeUndefined();
    expect(readNormalizedValue("8/512", "GB")).toBeUndefined();
    expect(readNormalizedValue("", "kg")).toBeUndefined();
  });
});
