import { describe, expect, it } from "vitest";

import { selectSummaryFacts } from ".";
import type { SummaryFact } from "../../types";

const fact = (id: string, groupKey: string, nodeId = "page-a"): SummaryFact => ({
  id,
  nodeId,
  groupKey,
  entityName: groupKey,
  entityType: "unknown",
  subject: groupKey,
  attribute: "a",
  attributeKey: "a",
  value: "1",
  quote: "q",
  isPageData: false,
});

const spec = (
  id: string,
  groupKey: string,
  attributeKey: string,
  extra: Partial<SummaryFact> = {},
) => ({
  ...fact(id, groupKey),
  attribute: attributeKey,
  attributeKey,
  ...extra,
});

describe("selectSummaryFacts", () => {
  it("takes every fact when there are fewer than the limit", () => {
    const facts = [fact("1", "x"), fact("2", "y")];

    expect(selectSummaryFacts(facts, 60)).toEqual({ selected: facts, omittedCount: 0 });
  });

  it("takes one fact from each group in turn, biggest group first", () => {
    const facts = [
      fact("a1", "a"),
      fact("a2", "a"),
      fact("a3", "a"),
      fact("b1", "b"),
      fact("c1", "c"),
    ];

    expect(selectSummaryFacts(facts, 4).selected.map(({ id }) => id)).toEqual([
      "a1",
      "b1",
      "c1",
      "a2",
    ]);
  });

  it("prefers a page not used yet within a group", () => {
    const facts = [fact("1", "x", "page-a"), fact("2", "x", "page-a"), fact("3", "x", "page-b")];

    expect(selectSummaryFacts(facts, 2).selected.map(({ id }) => id)).toEqual(["1", "3"]);
  });

  it("counts what it left out", () => {
    const facts = Array.from({ length: 90 }, (_, index) => fact(String(index), `g${index % 7}`));

    expect(selectSummaryFacts(facts, 60).omittedCount).toBe(30);
    expect(selectSummaryFacts(facts, 60).selected).toHaveLength(60);
  });

  describe("by importance", () => {
    it("takes a price and what two products state before trivia in a cluster of 188 facts", () => {
      const trivia = Array.from({ length: 185 }, (_, index) =>
        spec(`t${String(index).padStart(3, "0")}`, `subject:t${index}`, `feature ${index}`),
      );
      const facts = [
        ...trivia,
        spec("price", "phone", "price", { isPageData: true, value: "24399" }),
        spec("battery", "phone", "battery capacity", { value: "5100" }),
        spec("battery2", "tablet", "battery capacity", { value: "7000" }),
      ];
      const ids = selectSummaryFacts(facts, 60).selected.map(({ id }) => id);

      expect(facts).toHaveLength(188);
      expect(ids).toContain("price");
      expect(ids).toContain("battery");
      expect(ids).toContain("battery2");
      expect(ids.slice(0, 3).toSorted()).toEqual(["battery", "battery2", "price"]);
    });

    it("does not let one attribute's variants fill the list before another gets a fact", () => {
      const storage = Array.from({ length: 40 }, (_, index) =>
        spec(`s${String(index).padStart(2, "0")}`, "phone", "storage", { value: String(index) }),
      );
      const facts = [...storage, spec("weight", "phone", "weight")];
      const ids = selectSummaryFacts(facts, 5).selected.map(({ id }) => id);

      expect(ids).toContain("weight");
      expect(ids.filter((id) => id.startsWith("s"))).toHaveLength(4);
      expect(ids.indexOf("weight")).toBeLessThan(2);
    });

    it("represents every product though one has 150 facts", () => {
      const big = Array.from({ length: 150 }, (_, index) =>
        spec(`a${String(index).padStart(3, "0")}`, "big", `feature ${index}`),
      );
      const facts = [...big, spec("b1", "b", "weight"), spec("c1", "c", "weight")];
      const ids = selectSummaryFacts(facts, 10).selected.map(({ id }) => id);

      expect(ids).toEqual(expect.arrayContaining(["b1", "c1"]));
    });

    it("counts a fact two pages state as more important than one a single page does", () => {
      const facts = [
        spec("a", "g1", "feature a", { nodeId: "p1", value: "yes" }),
        spec("b", "g1", "feature b", { nodeId: "p1", value: "yes" }),
        spec("c", "g2", "feature c", { nodeId: "p1", value: "five" }),
        spec("d", "g2", "feature c", { nodeId: "p2", value: "Five" }),
      ];

      expect(selectSummaryFacts(facts, 1).selected[0]?.id).toBe("c");
    });
  });
});
