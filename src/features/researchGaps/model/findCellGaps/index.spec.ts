import { describe, expect, it } from "vitest";

import { findCellGaps } from ".";
import type { ComparisonCell } from "@/features/comparisonTable";

const cell = (...urls: string[]): ComparisonCell => ({
  value: "1",
  alternativeCount: 0,
  isConflict: false,
  groups: [
    { value: "1", sources: urls.map((url) => ({ factId: url, pageTitle: url, url, quote: "q" })) },
  ],
});

const COLUMNS = [
  { key: "weight", label: "weight" },
  { key: "price", label: "price" },
];

describe("findCellGaps", () => {
  it("lists the empty cells of an entity seen on two pages", () => {
    expect(
      findCellGaps({
        columns: COLUMNS,
        rows: [
          {
            entityId: "neo",
            name: "MacBook Neo 13",
            cells: { weight: cell("https://a", "https://b") },
          },
        ],
      }),
    ).toEqual({ gaps: [{ entity: "MacBook Neo 13", attribute: "price" }], moreCount: 0 });
  });

  it("leaves out an entity seen on one page", () => {
    expect(
      findCellGaps({
        columns: COLUMNS,
        rows: [{ entityId: "x", name: "X", cells: { weight: cell("https://a", "https://a") } }],
      }).gaps,
    ).toEqual([]);
  });

  it("lists at most 20 and counts the rest", () => {
    const columns = Array.from({ length: 30 }, (_, index) => ({
      key: `c${index}`,
      label: `c${index}`,
    }));
    const { gaps, moreCount } = findCellGaps({
      columns: [{ key: "w", label: "w" }, ...columns],
      rows: [{ entityId: "x", name: "X", cells: { w: cell("https://a", "https://b") } }],
    });

    expect(gaps).toHaveLength(20);
    expect(moreCount).toBe(10);
  });
});
