import { describe, expect, it } from "vitest";

import { readAxeSource } from ".";

describe("readAxeSource", () => {
  it("reads the browser bundle, which defines axe.run", () => {
    const source = readAxeSource();

    expect(source.length).toBeGreaterThan(100_000);
    expect(source).toContain("axe");
  });
});
