import type { ProductCard } from "@/features/clusterSummaries";
import { describe, expect, it } from "vitest";

import { buildProductCardLines } from ".";

const citation = { factId: "a:0", pageTitle: "", url: "", quote: "" };
const card = (overrides: Partial<ProductCard>): ProductCard => ({
  entityId: "pixel 10a",
  name: "Pixel 10a",
  factCount: 9,
  price: null,
  specs: [],
  ...overrides,
});

describe("buildProductCardLines", () => {
  it("lists the price and the specs of a card", () => {
    expect(
      buildProductCardLines([
        card({
          price: { label: "price", value: "24399 UAH", citations: [citation] },
          specs: [{ label: "weight", value: "184 g", citations: [citation] }],
        }),
      ]),
    ).toEqual(["  Pixel 10a (9 facts): price 24399 UAH; weight 184 g"]);
  });

  it("says so when a card has neither", () => {
    expect(buildProductCardLines([card({})])).toEqual(["  Pixel 10a (9 facts): no specs"]);
  });
});
