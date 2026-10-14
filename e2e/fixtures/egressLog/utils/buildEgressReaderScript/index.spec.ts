import { describe, expect, it } from "vitest";

import { buildEgressReaderScript } from ".";

describe("buildEgressReaderScript", () => {
  it("returns the log as JSON, and refuses when nothing records", () => {
    const script = buildEgressReaderScript();

    expect(script).toContain("JSON.stringify(recorder.log)");
    expect(script).toContain("never started");
    expect(() => new Function(script)).not.toThrow();
  });
});
