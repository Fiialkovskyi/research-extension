import { UNKNOWN_ENTITY_TYPE } from "@/features/factExtraction";

import { CARD_HEADER_KEYS, MAXIMUM_PRODUCT_CARDS, MINIMUM_CARD_FACTS } from "../../constants";
import type { ProductCard, SummaryCitation, SummaryFact } from "../../types";
import { readKeySpecPlaces } from "../readKeySpecPlaces";
import { buildSpecs } from "./utils/buildSpecs";
import { pickValue } from "./utils/pickValue";

/** The type most root entities with enough facts have, however it is named; none when none is typed. */
const readDominantType = (groups: readonly (readonly SummaryFact[])[]): string | undefined => {
  const counts = new Map<string, number>();

  for (const [first] of groups) {
    if (first !== undefined && first.entityType !== UNKNOWN_ENTITY_TYPE) {
      counts.set(first.entityType, (counts.get(first.entityType) ?? 0) + 1);
    }
  }

  return [...counts.entries()].toSorted(([a, x], [b, y]) => y - x || a.localeCompare(b))[0]?.[0];
};

/**
 * Makes a cluster's product cards from its facts, without the model: one for
 * each root entity with at least three facts that has a fact from the page's
 * own data, or is of the commonest type among such entities — however the type
 * is named, in any language — the best supported first (then by name), at most
 * six. A card has the entity's name, its price — the value from the page's own
 * data when there is one, else the commonest — and its key specs, each naming
 * the pages that state it. The facts given are those the user did not mark wrong.
 *
 * @returns The cards, and how many entities were left out for the limit.
 */
export const readProductCards = (
  facts: readonly SummaryFact[],
  toCitation: (fact: SummaryFact) => SummaryCitation,
): { cards: ProductCard[]; omittedProductCount: number } => {
  const places = readKeySpecPlaces(facts, { isSharedOnly: false });
  const worthy = [...Map.groupBy(facts, ({ groupKey }) => groupKey).entries()].filter(
    ([, members]) => members.length >= MINIMUM_CARD_FACTS,
  );
  const dominantType = readDominantType(worthy.map(([, members]) => members));
  const products = worthy
    .filter(([, members]) =>
      members.some(({ isPageData, entityType }) => isPageData || entityType === dominantType),
    )
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
      specs: buildSpecs(members, places, toCitation),
    };
  });

  return { cards, omittedProductCount: products.length - cards.length };
};
