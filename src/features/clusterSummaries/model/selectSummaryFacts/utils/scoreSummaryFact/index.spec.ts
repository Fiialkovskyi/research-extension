import { describe, expect, it } from "vitest";

import { scoreSummaryFact } from ".";
import type { SummaryFact } from "../../../../types";

const fact = (overrides: Partial<SummaryFact> = {}): SummaryFact => ({
  id: "f",
  nodeId: "n",
  groupKey: "g",
  entityName: "Pixel",
  entityType: "product",
  subject: "Pixel",
  attribute: "x",
  attributeKey: "x",
  value: "1",
  quote: "q",
  isPageData: false,
  ...overrides,
});

describe("scoreSummaryFact", () => {
  it("puts the page's own data first, then key specs by their place, then what two pages state", () => {
    const data = scoreSummaryFact(
      fact({ isPageData: true, attributeKey: "price" }),
      false,
      undefined,
    );
    const first = scoreSummaryFact(fact(), false, 0);
    const second = scoreSummaryFact(fact(), false, 1);
    const corroborated = scoreSummaryFact(fact(), true, undefined);
    const trivia = scoreSummaryFact(fact(), false, undefined);

    expect(data).toBeGreaterThan(first);
    expect(first).toBeGreaterThan(second);
    expect(second).toBeGreaterThan(corroborated);
    expect(corroborated).toBeGreaterThan(trivia);
  });

  it("puts the page's brand and the like below a key spec, and above what two pages state", () => {
    const brand = scoreSummaryFact(
      fact({ isPageData: true, attributeKey: "brand" }),
      false,
      undefined,
    );

    expect(brand).toBeLessThan(scoreSummaryFact(fact(), false, 9));
    expect(brand).toBeGreaterThan(scoreSummaryFact(fact(), true, undefined));
  });

  it("does not count a place past the key specs", () => {
    expect(scoreSummaryFact(fact(), false, 10)).toBe(0);
  });
});
