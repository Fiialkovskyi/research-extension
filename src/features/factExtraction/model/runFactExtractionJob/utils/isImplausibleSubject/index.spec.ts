import { describe, expect, it } from "vitest";

import { isImplausibleSubject } from ".";

describe("isImplausibleSubject", () => {
  it.each([
    ["6,3″ Super Retina XDR", "OLED", undefined],
    ["27", "yes", undefined],
    ["", "x", undefined],
    ["—", "x", undefined],
    ["256 GB", "yes", undefined],
    ["5100 мАг", "yes", undefined],
    ["30 Вт", "yes", undefined],
    ['6.3" display', "OLED", undefined],
  ])("drops %j as a subject", (subject, value, unit) => {
    expect(isImplausibleSubject({ subject, value, unit })).toBe(true);
  });

  it("drops a subject that is the fact's own value, with or without its unit", () => {
    expect(isImplausibleSubject({ subject: "256GB", value: "256", unit: "GB" })).toBe(true);
    expect(isImplausibleSubject({ subject: "Lavender", value: "lavender" })).toBe(true);
    expect(isImplausibleSubject({ subject: "256", value: "256", unit: "GB" })).toBe(true);
  });

  it.each([
    "3M Scotch",
    "7-Zip",
    "20 Minutes",
    "iPhone 17",
    "Google Pixel 10a",
    "Apple Watch SE 3",
  ])("keeps %j", (subject) => {
    expect(isImplausibleSubject({ subject, value: "x" })).toBe(false);
  });

  it("keeps a Ukrainian product name", () => {
    expect(isImplausibleSubject({ subject: "Ремінець LAUT Steel Loop", value: "38 мм" })).toBe(
      false,
    );
  });
});
