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

/** A fact whose page was published on `date`, from a site when given. */
const dated = (id: string, value: string, date: string, siteName?: string): TableFact => ({
  ...fact(id, value),
  publishedDate: date,
  publishedTime: Date.parse(date),
  ...(siteName === undefined ? {} : { siteName }),
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

  describe("the newest source of a conflict", () => {
    it("marks the value whose source is strictly newest, and changes nothing else", () => {
      const plain = buildCell([fact("a", "23"), fact("b", "25")]);
      const cell = buildCell([
        dated("a", "23", "2025-01-10"),
        dated("b", "25", "2026-05-01", "Bike Lab"),
      ]);

      expect(
        cell.groups.filter(({ isNewest }) => isNewest === true).map(({ value }) => value),
      ).toEqual(["25"]);
      expect(cell.groups.find(({ value }) => value === "25")?.sources[0]).toMatchObject({
        siteName: "Bike Lab",
        publishedDate: "2026-05-01",
      });
      expect(cell).toMatchObject({
        value: plain.value,
        alternativeCount: plain.alternativeCount,
        isConflict: true,
      });
      expect(cell.groups.map(({ value }) => value)).toEqual(plain.groups.map(({ value }) => value));
    });

    it("uses a value's newest source when it has several", () => {
      const cell = buildCell([
        dated("a", "23", "2024-01-01"),
        dated("b", "23", "2026-06-01"),
        dated("c", "25", "2026-05-01"),
      ]);

      expect(cell.groups.find(({ isNewest }) => isNewest === true)?.value).toBe("23");
    });

    it("marks none when only one value has a dated source", () => {
      const cell = buildCell([dated("a", "23", "2026-05-01"), fact("b", "25")]);

      expect(cell.groups.some(({ isNewest }) => isNewest === true)).toBe(false);
    });

    it("marks none when the newest dates tie", () => {
      const cell = buildCell([dated("a", "23", "2026-05-01"), dated("b", "25", "2026-05-01")]);

      expect(cell.groups.some(({ isNewest }) => isNewest === true)).toBe(false);
    });

    it("marks none where there is no conflict", () => {
      const cell = buildCell([dated("a", "23", "2026-05-01"), dated("b", "23", "2025-01-01")]);

      expect(cell.isConflict).toBe(false);
      expect(cell.groups.some(({ isNewest }) => isNewest === true)).toBe(false);
    });
  });
});
