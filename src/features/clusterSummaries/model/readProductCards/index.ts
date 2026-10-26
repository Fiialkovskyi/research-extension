import { CARD_HEADER_KEYS, MAXIMUM_PRODUCT_CARDS, MINIMUM_CARD_FACTS } from "../../constants";
import type { ProductCard, SummaryCitation, SummaryFact } from "../../types";
import { buildSpecs } from "./utils/buildSpecs";
import { pickValue } from "./utils/pickValue";

/**
 * Makes a cluster's product cards from its facts, without the model: one for
 * each root entity of type `product` with at least three facts, the best
 * supported first (then by name), at most six. A card has the product's name,
 * its price — the value from the page's own data when there is one, else the
 * commonest — and its key specs, each naming the pages that state it. The facts
 * given are those the user did not mark wrong.
 *
 * @returns The cards, and how many products were left out for the limit.
 */
export const readProductCards = (
  facts: readonly SummaryFact[],
  toCitation: (fact: SummaryFact) => SummaryCitation,
): { cards: ProductCard[]; omittedProductCount: number } => {
  const products = [
    ...Map.groupBy(
      facts.filter(({ entityType }) => entityType === "product"),
      ({ groupKey }) => groupKey,
    ).entries(),
  ]
    .filter(([, members]) => members.length >= MINIMUM_CARD_FACTS)
    .toSorted(
      ([, a], [, b]) =>
        b.length - a.length || (a[0]?.entityName ?? "").localeCompare(b[0]?.entityName ?? ""),
    );
  const cards = products.slice(0, MAXIMUM_PRODUCT_CARDS).map(([entityId, members]): ProductCard => {
    const price = pickValue(
      members.filter(({ attributeKey }) => attributeKey === CARD_HEADER_KEYS[0]),
    );

    return {
      entityId,
      name: members[0]?.entityName ?? entityId,
      factCount: members.length,
      price:
        price === undefined
          ? null
          : {
              label: "price",
              value: price.value,
              citations: price.facts.slice(0, 1).map(toCitation),
            },
      specs: buildSpecs(members, toCitation),
    };
  });

  return { cards, omittedProductCount: products.length - cards.length };
};
