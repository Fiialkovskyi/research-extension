import { describe, expect, it } from "vitest";

import { parsePublishedDate } from ".";

const NOW = Date.UTC(2026, 9, 26);

describe("parsePublishedDate", () => {
  it("reads an ISO time as its UTC calendar date and a timestamp", () => {
    expect(parsePublishedDate("2026-05-01T08:00:00Z", NOW)).toEqual({
      time: Date.UTC(2026, 4, 1, 8),
      date: "2026-05-01",
    });
  });

  it("reads a plain date", () => {
    expect(parsePublishedDate("2025-01-10", NOW)?.date).toBe("2025-01-10");
  });

  it("shows the UTC day, whatever offset the page wrote", () => {
    expect(parsePublishedDate("2026-05-01T23:30:00-05:00", NOW)?.date).toBe("2026-05-02");
  });

  it("refuses what does not parse", () => {
    expect(parsePublishedDate("last Tuesday", NOW)).toBeUndefined();
    expect(parsePublishedDate("", NOW)).toBeUndefined();
  });

  it("refuses a date in the future or before 1990", () => {
    expect(parsePublishedDate("2027-01-01", NOW)).toBeUndefined();
    expect(parsePublishedDate("1989-12-31", NOW)).toBeUndefined();
  });

  it("accepts a date as late as now and as early as 1990", () => {
    expect(parsePublishedDate("2026-10-26T00:00:00Z", NOW)?.date).toBe("2026-10-26");
    expect(parsePublishedDate("1990-01-01T00:00:00Z", NOW)?.date).toBe("1990-01-01");
  });
});
