import { describe, expect, it } from "vitest";

import { buildProcessMemoryScript } from ".";

describe("buildProcessMemoryScript", () => {
  it("lists the child processes' type and memory", () => {
    const script = buildProcessMemoryScript();

    expect(script).toContain("ChromeUtils.requestProcInfo()");
    expect(script).toContain("({ type, memory })");
    expect(() => new Function(script)).not.toThrow();
  });
});
