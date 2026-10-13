import { describe, expect, it } from "vitest";

import { buildCell } from ".";
import type { TableFact } from "../../types";

const fact = (id: string, value: string, unit?: string, nodeId = `page-${id}`): TableFact => ({
  id,
  rowId: "volta",
  nodeId,
  attribute: "weight",
  attributeKey: "weight",
  value,
  ...(unit === undefined ? {} : { unit }),
  quote: `says ${value}`,
  pageTitle: `Page ${id}`,
  url: `https://example.org/${id}`,
});

describe("buildCell", () => {
  it("shows the value its sources agree on, without a conflict", () => {
    const cell = buildCell([fact("a", "23.5", "kg"), fact("b", "23 500", "g")]);

    expect(cell).toMatchObject({ value: "23.5 kg", alternativeCount: 0, isConflict: false });
    expect(cell.groups[0]?.sources.map(({ url }) => url)).toEqual([
      "https://example.org/a",
      "https://example.org/b",
    ]);
  });

  it("flags disagreeing sources as a conflict and keeps every value with its sources", () => {
    const cell = buildCell([fact("a", "1749", "USD"), fact("b", "1999", "USD")]);

    expect(cell).toMatchObject({ value: "1749 USD", alternativeCount: 1, isConflict: true });
    expect(cell.groups.map(({ value, sources }) => [value, sources[0]?.pageTitle])).toEqual([
      ["1749 USD", "Page a"],
      ["1999 USD", "Page b"],
    ]);
  });

  it("chooses the value most sources state", () => {
    const cell = buildCell([fact("a", "20", "kg"), fact("b", "25", "kg"), fact("c", "25", "kg")]);

    expect(cell.value).toBe("25 kg");
  });

  it("breaks a tie by pages, then by order", () => {
    const fromOnePage = [fact("a1", "20", "kg", "page-x"), fact("a2", "20", "kg", "page-x")];
    const fromTwoPages = [fact("b1", "30", "kg", "page-y"), fact("b2", "30", "kg", "page-z")];

    expect(buildCell([...fromOnePage, ...fromTwoPages]).value).toBe("30 kg");
    expect(buildCell([fact("a", "20", "kg"), fact("b", "30", "kg")]).value).toBe("20 kg");
  });

  it("does not drift through a chain of values each near the next", () => {
    const cell = buildCell([
      fact("a", "100", "kg"),
      fact("b", "104", "kg"),
      fact("c", "108", "kg"),
    ]);

    expect(cell.groups.map(({ value }) => value)).toEqual(["100 kg", "108 kg"]);
  });
});
