import { describe, expect, it } from "vitest";

import { buildPageAccessGrantScript } from ".";

describe("buildPageAccessGrantScript", () => {
  it("grants access to every page to the named add-on, telling the running add-on", () => {
    const script = buildPageAccessGrantScript("research-graph@example.org");

    expect(script).toContain('WebExtensionPolicy.getByID("research-graph@example.org")');
    expect(script).toContain('origins: ["<all_urls>"]');
    expect(script).toContain("policy.extension");
  });

  it("parses as a function body", () => {
    expect(() => new Function(buildPageAccessGrantScript("a@b"))).not.toThrow();
  });
});
