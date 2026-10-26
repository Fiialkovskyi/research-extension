import { isVariantAttributeKey } from "@/shared/isVariantAttributeKey";
import { normalizeEntityName } from "@/shared/normalizeEntityName";
import { GENERIC_ATTRIBUTES } from "@/shared/config";

import {
  CARD_HEADER_KEYS,
  KEY_SPEC_ORDER,
  MAXIMUM_CARD_SPECS,
  MAXIMUM_VALUE_SOURCES,
} from "../../../../constants";
import type { CardValue, SummaryCitation, SummaryFact } from "../../../../types";
import { pickValue } from "../pickValue";
import { writeFactValue } from "../writeFactValue";

/** How a spec ranks: its place in the order of key specs, or after them. */
const readPlace = (key: string): number => {
  const place = (KEY_SPEC_ORDER as readonly string[]).indexOf(key);

  return place === -1 ? KEY_SPEC_ORDER.length : place;
};

/** The label the pages most often write for a spec; the earlier of two equally common wins. */
const readLabel = (facts: readonly SummaryFact[]): string =>
  [
    ...Map.groupBy(
      facts.toSorted((a, b) => a.id.localeCompare(b.id)),
      ({ attribute }) => attribute.trim(),
    ),
  ].toSorted(([, a], [, b]) => b.length - a.length)[0]?.[0] ?? "";

/**
 * Builds a product's key specs from its facts: leaving out the price and the
 * other header attributes and generic ones, ordered by importance — the key
 * specs in their order, then the rest by how many facts state them — at most
 * five. A spec shows the value most facts state and names the pages that state
 * it; a variant, such as storage, shows its values together.
 */
export const buildSpecs = (
  facts: readonly SummaryFact[],
  toCitation: (fact: SummaryFact) => SummaryCitation,
): CardValue[] => {
  const skipped = new Set<string>([
    ...CARD_HEADER_KEYS,
    ...GENERIC_ATTRIBUTES.map((attribute) => normalizeEntityName(attribute)),
  ]);

  return [...Map.groupBy(facts, ({ attributeKey }) => attributeKey).entries()]
    .filter(([key]) => !skipped.has(key))
    .toSorted(
      ([keyA, a], [keyB, b]) =>
        readPlace(keyA) - readPlace(keyB) || b.length - a.length || keyA.localeCompare(keyB),
    )
    .slice(0, MAXIMUM_CARD_SPECS)
    .flatMap(([key, group]): CardValue[] => {
      const label = readLabel(group);

      if (isVariantAttributeKey(key)) {
        const values = [
          ...Map.groupBy(
            group.toSorted((a, b) => a.id.localeCompare(b.id)),
            writeFactValue,
          ).entries(),
        ];

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
