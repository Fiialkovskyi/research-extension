import { describe, expect, it } from "vitest";

import { buildEgressRecorderScript } from ".";

describe("buildEgressRecorderScript", () => {
  it("observes requests before they are sent, for this add-on only", () => {
    const script = buildEgressRecorderScript("research-graph@example.org");

    expect(script).toContain('"http-on-modify-request"');
    expect(script).toContain('const extensionId = "research-graph@example.org"');
    expect(script).toContain("nsIExpandedPrincipal");
  });

  it("parses as a function body", () => {
    expect(() => new Function(buildEgressRecorderScript("a@b"))).not.toThrow();
  });
});
