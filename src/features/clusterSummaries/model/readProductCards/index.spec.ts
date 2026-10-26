import { describe, expect, it } from "vitest";

import { readProductCards } from ".";
import type { SummaryCitation, SummaryFact } from "../../types";

const fact = (
  id: string,
  entityName: string,
  attributeKey: string,
  value: string,
  overrides: Partial<SummaryFact> = {},
): SummaryFact => ({
  id,
  nodeId: `page-${id}`,
  groupKey: entityName,
  entityName,
  entityType: "product",
  subject: entityName,
  attribute: attributeKey,
  attributeKey,
  value,
  quote: `says ${value}`,
  isPageData: false,
  ...overrides,
});

const toCitation = ({ id, quote }: SummaryFact): SummaryCitation => ({
  factId: id,
  pageTitle: "Page",
  url: `https://example.org/${id}`,
  quote,
});

/** `count` facts of a product, each a different attribute but the price. */
const manyFacts = (name: string, count: number, prefix = name): SummaryFact[] =>
  Array.from({ length: count }, (_, index) =>
    fact(`${prefix}${String(index).padStart(2, "0")}`, name, `feature ${index}`, "yes"),
  );

describe("readProductCards", () => {
  it("makes a card for each product, the best supported first", () => {
    const { cards } = readProductCards(
      [...manyFacts("Pixel 10a", 8, "p"), ...manyFacts("iPhone 17", 12, "i")],
      toCitation,
    );

    expect(cards.map(({ name, factCount }) => [name, factCount])).toEqual([
      ["iPhone 17", 12],
      ["Pixel 10a", 8],
    ]);
  });

  it("makes none for an entity with too few facts, or one that is not a product", () => {
    const { cards, omittedProductCount } = readProductCards(
      [
        ...manyFacts("Tiny", 2),
        ...manyFacts("Acme", 10).map((item) => ({ ...item, entityType: "company" })),
        ...manyFacts("Thing", 10).map((item) => ({ ...item, entityType: "unknown" })),
      ],
      toCitation,
    );

    expect(cards).toEqual([]);
    expect(omittedProductCount).toBe(0);
  });

  it("shows six cards and says how many products were left out", () => {
    const facts = Array.from({ length: 8 }, (_, index) => manyFacts(`Product ${index}`, 3 + index));
    const { cards, omittedProductCount } = readProductCards(facts.flat(), toCitation);

    expect(cards).toHaveLength(6);
    expect(cards[0]?.name).toBe("Product 7");
    expect(omittedProductCount).toBe(2);
  });

  it("takes the price from the page's own data, with its source, over a model's reading", () => {
    const { cards } = readProductCards(
      [
        fact("a", "Pixel 10a", "price", "24 000", { unit: "грн" }),
        fact("b", "Pixel 10a", "price", "24 000", { unit: "грн" }),
        fact("z", "Pixel 10a", "price", "24399", { unit: "UAH", isPageData: true }),
      ],
      toCitation,
    );

    expect(cards[0]?.price).toEqual({
      label: "price",
      value: "24399 UAH",
      citations: [
        { factId: "z", pageTitle: "Page", url: "https://example.org/z", quote: "says 24399" },
      ],
    });
  });

  it("gives a card without a price when no fact states one", () => {
    const { cards } = readProductCards(manyFacts("Pixel 10a", 4), toCitation);

    expect(cards[0]?.price).toBeNull();
    expect(cards[0]?.specs.length).toBeGreaterThan(0);
  });

  it("keeps the price out of the key specs", () => {
    const { cards } = readProductCards(
      [
        fact("a", "Pixel 10a", "price", "1"),
        fact("b", "Pixel 10a", "weight", "190"),
        fact("c", "Pixel 10a", "battery capacity", "5100"),
      ],
      toCitation,
    );

    expect(cards[0]?.specs.map(({ label }) => label)).toEqual(["battery capacity", "weight"]);
  });
});
