import { FACT_POSITION_PENALTY } from "../../constants";
import type { SummaryFact } from "../../types";
import { readKeySpecPlaces } from "../readKeySpecPlaces";
import { scoreSummaryFact } from "./utils/scoreSummaryFact";

/** A fact's value with its unit, set apart from spacing and case: what two pages must agree on. */
const writeValueKey = ({ value, unit }: SummaryFact): string =>
  `${value} ${unit ?? ""}`.toLowerCase().replaceAll(/\s+/gu, " ").trim();

/**
 * Orders one group's facts for choosing: first the best fact of each attribute,
 * then the rest, each time the highest score, a page not yet used before one
 * already used, then by id.
 */
const orderGroup = (
  members: readonly SummaryFact[],
  places: ReadonlyMap<string, number>,
): { fact: SummaryFact; score: number }[] => {
  const pagesByValue = Map.groupBy(
    members,
    (fact) => `${fact.attributeKey}\u0000${writeValueKey(fact)}`,
  );
  const left = members.map((fact) => ({
    fact,
    score: scoreSummaryFact(
      fact,
      new Set(
        (pagesByValue.get(`${fact.attributeKey}\u0000${writeValueKey(fact)}`) ?? []).map(
          ({ nodeId }) => nodeId,
        ),
      ).size > 1,
      places.get(fact.attributeKey),
    ),
  }));
  const usedKeys = new Set<string>();
  const usedPages = new Set<string>();
  const ordered: { fact: SummaryFact; score: number }[] = [];

  while (left.length > 0) {
    const best = left.toSorted(
      (a, b) =>
        Number(usedKeys.has(a.fact.attributeKey)) - Number(usedKeys.has(b.fact.attributeKey)) ||
        b.score - a.score ||
        Number(usedPages.has(a.fact.nodeId)) - Number(usedPages.has(b.fact.nodeId)) ||
        a.fact.id.localeCompare(b.fact.id),
    )[0]!;

    left.splice(left.indexOf(best), 1);
    usedKeys.add(best.fact.attributeKey);
    usedPages.add(best.fact.nodeId);
    ordered.push(best);
  }

  return ordered;
};

/**
 * Chooses at most `limit` facts for one summary by importance: a fact from the
 * page's own product data, then a key spec (one of the cluster's most
 * comparable concepts, the more the better), then a fact more than one page states, then the rest. Within a
 * group — an entity, or a subject without one — each attribute gets a fact
 * before any gets a second, and each place down a group's list costs
 * {@link FACT_POSITION_PENALTY}, so no group takes every slot while another
 * has none.
 *
 * @returns The facts chosen, best first, and how many were left out.
 */
export const selectSummaryFacts = (
  facts: readonly SummaryFact[],
  limit: number,
): { selected: SummaryFact[]; omittedCount: number } => {
  const places = readKeySpecPlaces(facts, { isSharedOnly: true });
  const ranked = [...Map.groupBy(facts, ({ groupKey }) => groupKey).values()]
    .flatMap((members) =>
      orderGroup(members, places).map(({ fact, score }, position) => ({
        fact,
        weight: score - position * FACT_POSITION_PENALTY,
        position,
      })),
    )
    .toSorted(
      (a, b) =>
        b.weight - a.weight || a.position - b.position || a.fact.id.localeCompare(b.fact.id),
    );
  const selected = ranked.slice(0, limit).map(({ fact }) => fact);

  return { selected, omittedCount: facts.length - selected.length };
};
