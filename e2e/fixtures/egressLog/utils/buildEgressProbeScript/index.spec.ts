import { describe, expect, it } from "vitest";

import { buildEgressProbeScript } from ".";

describe("buildEgressProbeScript", () => {
  it("requests the URL with the add-on's own principal", () => {
    const script = buildEgressProbeScript("a@b", "http://127.0.0.1:1/probe");

    expect(script).toContain('getByID("a@b")');
    expect(script).toContain("loadingPrincipal: policy.extension.principal");
    expect(script).toContain('uri: "http://127.0.0.1:1/probe"');
    expect(() => new Function(script)).not.toThrow();
  });
});
