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
  it("puts the page's own data first, then key specs by their order, then what two pages state", () => {
    const data = scoreSummaryFact(fact({ isPageData: true, attributeKey: "price" }), false);
    const screen = scoreSummaryFact(fact({ attributeKey: "screen size" }), false);
    const battery = scoreSummaryFact(fact({ attributeKey: "battery capacity" }), false);
    const corroborated = scoreSummaryFact(fact(), true);
    const trivia = scoreSummaryFact(fact(), false);

    expect(data).toBeGreaterThan(screen);
    expect(screen).toBeGreaterThan(battery);
    expect(battery).toBeGreaterThan(corroborated);
    expect(corroborated).toBeGreaterThan(trivia);
  });
});
