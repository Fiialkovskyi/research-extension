import { describe, expect, it } from "vitest";

import { repairSubject } from ".";

const pixel = "Google Pixel 10 Pro 16/256GB (Porcelain)";
const watch =
  "Apple Watch SE 3 GPS, 40mm Starlight Aluminum Case with Starlight Sport Band (S/M) (MEH34)";

describe("repairSubject", () => {
  it("gives the product's name to a subject with a stray character in it", () => {
    expect(repairSubject("Google Pixel 1: 10 Pro 16/256GB (Porcelain)", pixel)).toBe(pixel);
    expect(
      repairSubject(
        "Apple Watch SE 3 GPS, 4:00mm Starlight Aluminum Case with Starlight Sport Band (S/M) (MEH34)",
        watch,
      ),
    ).toBe(watch);
  });

  it("gives it to a subject cut off in the middle of a word", () => {
    const strap = "Ремінець LAUT Steel Loop для Apple Watch 38/40/41/42mm (Silver)";

    expect(repairSubject("Ремінець LAUT Steel Loop для Apple Watch 38/4", strap)).toBe(strap);
  });

  it("leaves a shorter real name alone", () => {
    expect(repairSubject("Pixel 10 Pro", pixel)).toBe("Pixel 10 Pro");
    expect(repairSubject("Google Pixel 10", pixel)).toBe("Google Pixel 10");
  });

  it("leaves another product alone", () => {
    expect(repairSubject("Samsung Galaxy S25", pixel)).toBe("Samsung Galaxy S25");
  });

  it("leaves any subject alone when the page names no product", () => {
    expect(repairSubject("Google Pixel 1: 10 Pro", undefined)).toBe("Google Pixel 1: 10 Pro");
  });
});
