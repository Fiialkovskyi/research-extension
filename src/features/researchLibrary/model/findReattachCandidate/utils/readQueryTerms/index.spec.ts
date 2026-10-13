import { describe, expect, it } from "vitest";

import { readQueryTerms } from ".";

const terms = (query: string) => [...readQueryTerms(query)].toSorted();

describe("readQueryTerms", () => {
  it("keeps hyphenated words whole and splits on other punctuation", () => {
    expect(terms("E-bike mid-drive motors, 2026!")).toEqual([
      "2026",
      "e-bike",
      "mid-drive",
      "motors",
    ]);
  });

  it("drops stop words, single characters and stray hyphens", () => {
    expect(terms("the best motors for a - bike")).toEqual(["bike", "motors"]);
  });

  it("ignores case and repeats", () => {
    expect(terms("Motors MOTORS motors")).toEqual(["motors"]);
  });
});
