import { describe, expect, it } from "vitest";

import { buildAxeAuditScript } from ".";

describe("buildAxeAuditScript", () => {
  it("loads axe, then audits the document against WCAG 2 A and AA", () => {
    const script = buildAxeAuditScript("window.axe = {};");

    expect(script.indexOf("window.axe = {};")).toBeLessThan(script.indexOf("axe\n    .run"));
    expect(script).toContain('"wcag2aa"');
    expect(() => new Function(script)).not.toThrow();
  });
});
