import { describe, expect, it } from "vitest";

import { isKnownUnit } from ".";

describe("isKnownUnit", () => {
  it.each(["kg", "KG", "мм", "GB", "Вт", " m ", '"', "″", "Wh"])("knows %j", (unit) => {
    expect(isKnownUnit(unit)).toBe(true);
  });

  it.each(["Minutes", "Zip", "", "Pro", "toString"])("does not know %j", (unit) => {
    expect(isKnownUnit(unit)).toBe(false);
  });
});
