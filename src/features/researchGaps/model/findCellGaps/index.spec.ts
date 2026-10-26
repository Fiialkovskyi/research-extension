import { describe, expect, it } from "vitest";

import { findCellGaps } from ".";
import type { ComparisonCell } from "@/features/comparisonTable";

/** A cell whose sources are the given pages, one fact each. */
const cell = (...urls: string[]): ComparisonCell => ({
  value: "1",
  alternativeCount: 0,
  isConflict: false,
  groups: [
    {
      value: "1",
      sources: urls.map((url, index) => ({
        factId: `${url}#${index}`,
        pageTitle: url,
        url,
        quote: "q",
      })),
    },
  ],
});

const COLUMNS = ["weight", "price", "colour", "size", "finish"].map((key) => ({ key, label: key }));

/** A row confirmed by facts on two pages, with the given columns filled. */
const row = (name: string, ...filled: string[]) => ({
  entityId: name,
  name,
  cells: Object.fromEntries(
    filled.map((key, index) => [key, cell(`https://a/${index}`, "https://b")]),
  ),
});

describe("findCellGaps", () => {
  it("lists what an entity confirmed by three facts on two pages lacks, in one gap", () => {
    expect(
      findCellGaps({ columns: COLUMNS.slice(0, 3), rows: [row("Neo", "weight", "price")] }),
    ).toEqual({ gaps: [{ entity: "Neo", attributes: ["colour"], moreCount: 0 }], moreCount: 0 });
  });

  it("names three missing attributes and counts the rest", () => {
    const { gaps } = findCellGaps({
      columns: [...COLUMNS, { key: "extra", label: "extra" }],
      rows: [row("Neo", "weight", "price")],
    });

    expect(gaps).toEqual([
      { entity: "Neo", attributes: ["colour", "size", "finish"], moreCount: 1 },
    ]);
  });

  it("leaves out a row with fewer than three facts, or from one page", () => {
    const thin = { entityId: "x", name: "X", cells: { weight: cell("https://a", "https://b") } };
    const onePage = {
      entityId: "y",
      name: "Y",
      cells: { weight: cell("https://a", "https://a", "https://a") },
    };

    expect(findCellGaps({ columns: COLUMNS, rows: [thin, onePage] }).gaps).toEqual([]);
  });

  it("lists at most five entities and counts the rest", () => {
    const rows = Array.from({ length: 8 }, (_, index) => row(`P${index}`, "weight", "price"));
    const { gaps, moreCount } = findCellGaps({ columns: COLUMNS, rows });

    expect(gaps).toHaveLength(5);
    expect(moreCount).toBe(3);
  });
});
