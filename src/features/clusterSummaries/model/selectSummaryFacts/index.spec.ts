import { describe, expect, it } from "vitest";

import { selectSummaryFacts } from ".";
import type { SummaryFact } from "../../types";

const fact = (id: string, groupKey: string, nodeId = "page-a"): SummaryFact => ({
  id,
  nodeId,
  groupKey,
  subject: groupKey,
  attribute: "a",
  value: "1",
  quote: "q",
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
});
