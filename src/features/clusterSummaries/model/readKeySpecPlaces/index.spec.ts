import { describe, expect, it } from "vitest";

import { readKeySpecPlaces } from ".";
import type { SummaryFact } from "../../types";

const fact = (
  groupKey: string,
  nodeId: string,
  attributeKey: string,
  value: string,
): SummaryFact => ({
  id: `${groupKey}:${nodeId}:${attributeKey}`,
  nodeId,
  groupKey,
  entityName: groupKey,
  entityType: "килимок",
  subject: groupKey,
  attribute: attributeKey,
  attributeKey,
  value,
  quote: "q",
  isPageData: false,
});

describe("readKeySpecPlaces", () => {
  it("places what more products state first, with no list of attributes", () => {
    const facts = [
      fact("a", "p1", "висота ворсу", "12"),
      fact("b", "p2", "висота ворсу", "20"),
      fact("a", "p1", "колір", "сірий"),
      fact("b", "p2", "колір", "синій"),
      fact("a", "p1", "догляд", "ручне прання"),
    ];

    const all = readKeySpecPlaces(facts, { isSharedOnly: false });
    const shared = readKeySpecPlaces(facts, { isSharedOnly: true });

    expect(all.get("висота ворсу")).toBeLessThan(all.get("колір") ?? Infinity);
    expect(all.get("колір")).toBeLessThan(all.get("догляд") ?? -1);
    expect(shared.has("догляд")).toBe(false);
  });

  it("gives no place to prose or to what is the same on every product", () => {
    const prose = "ця річ зроблена з дуже м'якого матеріалу для щоденного використання у ванній";
    const facts = [
      fact("a", "p1", "опис", prose),
      fact("b", "p2", "опис", prose),
      fact("a", "p1", "категорія", "килимок"),
      fact("b", "p2", "категорія", "килимок"),
    ];

    expect(readKeySpecPlaces(facts, { isSharedOnly: false }).size).toBe(0);
  });
});
