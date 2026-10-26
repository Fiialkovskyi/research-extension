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

/** Where each key spec stands among the cluster's, by the order of the keys given. */
const placesOf = (...keys: string[]): Map<string, number> =>
  new Map(keys.map((key, place) => [key, place]));

describe("buildSpecs", () => {
  it("orders the specs by their place among the cluster's key specs, at most five", () => {
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
      placesOf("screen size", "battery capacity", "storage", "weight", "feature y", "feature x"),
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

  it("leaves out the header attributes and what is not a key spec", () => {
    const specs = buildSpecs(
      [
        fact("a", "price", "1", "UAH"),
        fact("b", "brand", "Google"),
        fact("c", "description", "text"),
        fact("d", "weight", "190", "g"),
      ],
      placesOf("price", "brand", "weight"),
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
      placesOf("battery capacity"),
      toCitation,
    );

    expect(spec?.value).toBe("5100 mAh");
    expect(spec?.citations.map(({ factId }) => factId)).toEqual(["b", "c"]);
  });

  it("shows the values one page states together, one source each", () => {
    const [spec] = buildSpecs(
      [
        { ...fact("a", "storage", "128", "GB"), nodeId: "x" },
        { ...fact("b", "storage", "256", "GB"), nodeId: "x" },
        { ...fact("c", "storage", "256", "GB"), nodeId: "y" },
      ],
      placesOf("storage"),
      toCitation,
    );

    expect(spec?.value).toBe("128 GB / 256 GB");
    expect(spec?.citations.map(({ factId }) => factId)).toEqual(["a", "b"]);
  });

  it("does not take the values of separate pages for options, whatever the attribute", () => {
    const [spec] = buildSpecs(
      [fact("a", "storage", "128", "GB"), fact("b", "storage", "256", "GB")],
      placesOf("storage"),
      toCitation,
    );

    expect(spec?.value).toBe("128 GB");
  });
});
