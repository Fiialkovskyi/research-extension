import { describe, expect, it } from "vitest";

import { isLabelValue } from ".";

const attributes = (name: string): boolean => ["display type", "connection type"].includes(name);

describe("isLabelValue", () => {
  it("is true for a value that is another fact's attribute, however it is cased or punctuated", () => {
    expect(isLabelValue({ value: "Display type" }, attributes)).toBe(true);
    expect(isLabelValue({ value: "Connection  Type:" }, attributes)).toBe(true);
  });

  it("is false for a value that states something", () => {
    expect(isLabelValue({ value: "OLED" }, attributes)).toBe(false);
    expect(isLabelValue({ value: "" }, attributes)).toBe(false);
  });
});
