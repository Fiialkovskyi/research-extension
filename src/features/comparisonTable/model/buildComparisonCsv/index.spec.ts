import { describe, expect, it } from "vitest";

import { buildComparisonCsv } from ".";
import type { ComparisonCell } from "../../types";

const cell = (value: string, urls: string[], isConflict = false): ComparisonCell => ({
  value,
  alternativeCount: isConflict ? 1 : 0,
  isConflict,
  groups: (isConflict ? [urls.slice(0, 1), urls.slice(1)] : [urls]).map((group) => ({
    value,
    sources: group.map((url) => ({ factId: url, pageTitle: "p", url, quote: "q" })),
  })),
});

const lines = (csv: string) => csv.replace(/^﻿/u, "").split("\r\n");

describe("buildComparisonCsv", () => {
  it("writes the entity, then each column and its sources", () => {
    const csv = buildComparisonCsv({
      columns: [{ key: "weight", label: "weight" }],
      rows: [
        {
          entityId: "v",
          name: "Volta",
          cells: { weight: cell("23.5 kg", ["https://a", "https://b"]) },
        },
        { entityId: "c", name: "Corsa", cells: {} },
      ],
    });

    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(lines(csv).slice(0, 3)).toEqual([
      "Entity,weight,weight sources",
      "Volta,23.5 kg,https://a https://b",
      "Corsa,,",
    ]);
  });

  it("follows a source with its site and publication day when the page gave them", () => {
    const csv = buildComparisonCsv({
      columns: [{ key: "weight", label: "weight" }],
      rows: [
        {
          entityId: "v",
          name: "Volta",
          cells: {
            weight: {
              value: "23.5 kg",
              alternativeCount: 0,
              isConflict: false,
              groups: [
                {
                  value: "23.5 kg",
                  sources: [
                    {
                      factId: "a",
                      pageTitle: "p",
                      url: "https://a",
                      quote: "q",
                      siteName: "Bike Lab",
                      publishedDate: "2026-05-01",
                    },
                    { factId: "b", pageTitle: "p", url: "https://b", quote: "q", siteName: "Shop" },
                    { factId: "c", pageTitle: "p", url: "https://c", quote: "q" },
                  ],
                },
              ],
            },
          },
        },
      ],
    });

    expect(lines(csv)[1]).toBe(
      'Volta,23.5 kg,"https://a [Bike Lab, 2026-05-01] https://b [Shop] https://c"',
    );
  });

  it("notes a conflict in the value", () => {
    const csv = buildComparisonCsv({
      columns: [{ key: "price", label: "price" }],
      rows: [
        {
          entityId: "v",
          name: "Volta",
          cells: { price: cell("1749 USD", ["https://a", "https://b"], true) },
        },
      ],
    });

    expect(lines(csv)[1]).toBe("Volta,1749 USD (conflict: 2 values),https://a https://b");
  });

  it("quotes commas, quotes and line breaks", () => {
    const csv = buildComparisonCsv({
      columns: [],
      rows: [{ entityId: "x", name: 'Bike, "Pro"\nEdition', cells: {} }],
    });

    expect(csv).toContain('"Bike, ""Pro""\nEdition"');
  });

  it.each(["=", "+", "-", "@", "\t", "\r"])(
    "keeps a field starting with %j from being evaluated",
    (trigger) => {
      const csv = buildComparisonCsv({
        columns: [],
        rows: [{ entityId: "x", name: `${trigger}SUM(A1)`, cells: {} }],
      });

      expect(csv).toContain(`'${trigger}SUM(A1)`);
    },
  );

  it("joins options with a slash and notes no conflict", () => {
    const options = {
      value: "128 GB",
      alternativeCount: 0,
      isConflict: false,
      isOptions: true,
      groups: [
        {
          value: "128 GB",
          sources: [{ factId: "a", pageTitle: "p", url: "https://a", quote: "q" }],
        },
        {
          value: "256 GB",
          sources: [{ factId: "b", pageTitle: "p", url: "https://a", quote: "q" }],
        },
      ],
    };
    const csv = buildComparisonCsv({
      columns: [{ key: "storage", label: "storage" }],
      rows: [{ entityId: "v", name: "Volta", cells: { storage: options } }],
    });

    expect(lines(csv)[1]).toBe("Volta,128 GB / 256 GB,https://a");
  });
});
