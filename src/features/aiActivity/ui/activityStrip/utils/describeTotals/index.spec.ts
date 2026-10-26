import { describe, expect, it } from "vitest";

import { describeTotals } from ".";

describe("describeTotals", () => {
  it("names each kind of finished work", () => {
    expect(describeTotals({ pagesRead: 14, factsFrom: 12, summaries: 3 })).toBe(
      "14 pages read · facts from 12 · 3 summaries",
    );
  });

  it("leaves out kinds with nothing finished, and uses the singular for one", () => {
    expect(describeTotals({ pagesRead: 1, summaries: 1 })).toBe("1 page read · 1 summary");
  });

  it("says nothing when nothing was finished", () => {
    expect(describeTotals({})).toBe("");
  });
});
