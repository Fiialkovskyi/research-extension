import { describe, expect, it } from "vitest";

import { pickValue } from ".";
import type { SummaryFact } from "../../../../types";

const fact = (id: string, value: string, overrides: Partial<SummaryFact> = {}): SummaryFact => ({
  id,
  nodeId: `page-${id}`,
  groupKey: "g",
  entityName: "Pixel",
  entityType: "product",
  subject: "Pixel",
  attribute: "battery",
  attributeKey: "battery capacity",
  value,
  unit: "mAh",
  quote: "q",
  isPageData: false,
  ...overrides,
});

describe("pickValue", () => {
  it("chooses the value most facts state, with the facts that state it", () => {
    const picked = pickValue([fact("a", "5000"), fact("b", "5100"), fact("c", "5100")]);

    expect(picked?.value).toBe("5100 mAh");
    expect(picked?.facts.map(({ id }) => id)).toEqual(["b", "c"]);
  });

  it("lets the first stated win a tie", () => {
    expect(pickValue([fact("b", "5100"), fact("a", "5000")])?.value).toBe("5000 mAh");
  });

  it("takes the page's own data over the commonest value", () => {
    const picked = pickValue([
      fact("a", "24 000", { unit: "грн" }),
      fact("b", "24 000", { unit: "грн" }),
      fact("z", "24399", { unit: "UAH", isPageData: true }),
    ]);

    expect(picked).toMatchObject({ value: "24399 UAH" });
    expect(picked?.facts.map(({ id }) => id)).toEqual(["z"]);
  });

  it("chooses nothing without facts", () => {
    expect(pickValue([])).toBeUndefined();
  });
});
