import { CARD_HEADER_KEYS, MAXIMUM_CARD_SPECS, MAXIMUM_VALUE_SOURCES } from "../../../../constants";
import type { CardValue, SummaryCitation, SummaryFact } from "../../../../types";
import { pickValue } from "../pickValue";
import { writeFactValue } from "../writeFactValue";

/** The label the pages most often write for a spec; the earlier of two equally common wins. */
const readLabel = (facts: readonly SummaryFact[]): string =>
  [
    ...Map.groupBy(
      facts.toSorted((a, b) => a.id.localeCompare(b.id)),
      ({ attribute }) => attribute.trim(),
    ),
  ].toSorted(([, a], [, b]) => b.length - a.length)[0]?.[0] ?? "";

/**
 * Builds a product's key specs from its facts: the concepts that are key specs
 * of the cluster (`readKeySpecPlaces`: stated by more products, not prose, not
 * the same on every product), in that order, leaving out the price and the
 * other header attributes — at most five. A spec shows the value most facts
 * state and names the pages that state it; when one page states several values
 * of it, they are options and are shown together.
 */
export const buildSpecs = (
  facts: readonly SummaryFact[],
  places: ReadonlyMap<string, number>,
  toCitation: (fact: SummaryFact) => SummaryCitation,
): CardValue[] => {
  const skipped = new Set<string>(CARD_HEADER_KEYS);

  return [...Map.groupBy(facts, ({ attributeKey }) => attributeKey).entries()]
    .filter(([key]) => !skipped.has(key) && places.has(key))
    .toSorted(
      ([keyA, a], [keyB, b]) =>
        (places.get(keyA) ?? 0) - (places.get(keyB) ?? 0) ||
        b.length - a.length ||
        keyA.localeCompare(keyB),
    )
    .slice(0, MAXIMUM_CARD_SPECS)
    .flatMap(([, group]): CardValue[] => {
      const label = readLabel(group);
      const values = [
        ...Map.groupBy(
          group.toSorted((a, b) => a.id.localeCompare(b.id)),
          writeFactValue,
        ).entries(),
      ];
      const isOptions = [...Map.groupBy(group, ({ nodeId }) => nodeId).values()].some(
        (page) => new Set(page.map(writeFactValue)).size > 1,
      );

      if (isOptions) {
        return [
          {
            label,
            value: values.map(([value]) => value).join(" / "),
            citations: values.flatMap(([, stating]) =>
              stating[0] === undefined ? [] : [toCitation(stating[0])],
            ),
          },
        ];
      }

      const picked = pickValue(group);

      return picked === undefined
        ? []
        : [
            {
              label,
              value: picked.value,
              citations: picked.facts.slice(0, MAXIMUM_VALUE_SOURCES).map(toCitation),
            },
          ];
    });
};
