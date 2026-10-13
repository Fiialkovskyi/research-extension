import { describe, expect, it } from "vitest";

import { isSummaryStale } from ".";

const SUMMARY = { factSetHash: "h1", modelRef: "m" };

describe("isSummaryStale", () => {
  it("is fresh while its facts and model are unchanged", () => {
    expect(isSummaryStale(SUMMARY, "h1", new Set(["m"]))).toBe(false);
  });

  it("is stale once its cluster's facts changed", () => {
    expect(isSummaryStale(SUMMARY, "h2", new Set(["m"]))).toBe(true);
  });

  it("is stale once its model is no longer installed", () => {
    expect(isSummaryStale(SUMMARY, "h1", new Set(["other"]))).toBe(true);
  });
});
