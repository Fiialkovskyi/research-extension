import { describe, expect, it } from "vitest";

import { normalizeEntityName } from ".";

describe("normalizeEntityName", () => {
  it("ignores case and surrounding space", () => {
    expect(normalizeEntityName("  MacBook NEO 13 ")).toBe("macbook neo 13");
  });

  it("drops quotes and inch marks", () => {
    expect(normalizeEntityName('MacBook Neo 13"')).toBe("macbook neo 13");
    expect(normalizeEntityName("“Volta” E5")).toBe("volta e5");
  });

  it("turns punctuation into spaces and collapses them", () => {
    expect(normalizeEntityName("Volta-E5 (2026)")).toBe("volta e5 2026");
  });

  it("folds full-width letters", () => {
    expect(normalizeEntityName("ＶＯＬＴＡ")).toBe("volta");
  });

  it("keeps Cyrillic", () => {
    expect(normalizeEntityName("Ноутбук Apple")).toBe("ноутбук apple");
  });

  it("keeps a number's decimal point or comma, as a point", () => {
    expect(normalizeEntityName("Motor 2.5 kW")).toBe("motor 2.5 kw");
    expect(normalizeEntityName("Motor 2,5 kW")).toBe("motor 2.5 kw");
  });
});
