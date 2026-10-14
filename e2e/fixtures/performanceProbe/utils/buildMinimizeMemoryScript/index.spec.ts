import { describe, expect, it } from "vitest";

import { buildMinimizeMemoryScript } from ".";

describe("buildMinimizeMemoryScript", () => {
  it("minimises memory in every process and waits for it", () => {
    const script = buildMinimizeMemoryScript();

    expect(script).toContain("minimizeMemoryUsage(() => resolve(true))");
    expect(() => new Function(script)).not.toThrow();
  });
});
