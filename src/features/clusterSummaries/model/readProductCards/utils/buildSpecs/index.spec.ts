import { describe, expect, it } from "vitest";

import { buildSpecs } from ".";
import type { SummaryCitation, SummaryFact } from "../../../../types";

const fact = (id: string, attributeKey: string, value: string, unit?: string): SummaryFact => ({
  id,
  nodeId: `page-${id}`,
  groupKey: "g",
  entityName: "Pixel",
  entityType: "product",
  subject: "Pixel",
  attribute: attributeKey,
  attributeKey,
  value,
  ...(unit === undefined ? {} : { unit }),
  quote: `says ${value}`,
  isPageData: false,
});

const toCitation = ({ id, quote }: SummaryFact): SummaryCitation => ({
  factId: id,
  pageTitle: "Page",
  url: `https://example.org/${id}`,
  quote,
});

describe("buildSpecs", () => {
  it("orders key specs by importance, then the rest by how many facts state them, at most five", () => {
    const specs = buildSpecs(
      [
        fact("a", "weight", "190", "g"),
        fact("b", "battery capacity", "5100", "mAh"),
        fact("c", "screen size", "6.3", "inch"),
        fact("d", "feature x", "yes"),
        fact("e", "feature y", "yes"),
        fact("f", "feature y", "yes"),
        fact("g", "feature z", "yes"),
        fact("h", "storage", "256", "GB"),
      ],
      toCitation,
    );

    expect(specs.map(({ label }) => label)).toEqual([
      "screen size",
      "battery capacity",
      "storage",
      "weight",
      "feature y",
    ]);
  });

  it("leaves out the header attributes and generic ones", () => {
    const specs = buildSpecs(
      [
        fact("a", "price", "1", "UAH"),
        fact("b", "brand", "Google"),
        fact("c", "description", "text"),
        fact("d", "weight", "190", "g"),
      ],
      toCitation,
    );

    expect(specs.map(({ label }) => label)).toEqual(["weight"]);
  });

  it("shows the commonest value, with the pages that state it", () => {
    const [spec] = buildSpecs(
      [
        fact("a", "battery capacity", "5000", "mAh"),
        fact("b", "battery capacity", "5100", "mAh"),
        fact("c", "battery capacity", "5100", "mAh"),
      ],
      toCitation,
    );

    expect(spec?.value).toBe("5100 mAh");
    expect(spec?.citations.map(({ factId }) => factId)).toEqual(["b", "c"]);
  });

  it("shows a variant's values together, one source each", () => {
    const [spec] = buildSpecs(
      [
        fact("a", "storage", "128", "GB"),
        fact("b", "storage", "256", "GB"),
        fact("c", "storage", "256", "GB"),
      ],
      toCitation,
    );

    expect(spec?.value).toBe("128 GB / 256 GB");
    expect(spec?.citations.map(({ factId }) => factId)).toEqual(["a", "b"]);
  });
});
