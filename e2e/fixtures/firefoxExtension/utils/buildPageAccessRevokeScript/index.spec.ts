import { describe, expect, it } from "vitest";

import { buildPageAccessRevokeScript } from ".";

describe("buildPageAccessRevokeScript", () => {
  it("removes access to every page from the named add-on, telling the running add-on", () => {
    const script = buildPageAccessRevokeScript("research-graph@example.org");

    expect(script).toContain('WebExtensionPolicy.getByID("research-graph@example.org")');
    expect(script).toContain("ExtensionPermissions.remove");
    expect(script).toContain('origins: ["<all_urls>"]');
    expect(script).toContain("policy.extension");
  });

  it("parses as a function body", () => {
    expect(() => new Function(buildPageAccessRevokeScript("a@b"))).not.toThrow();
  });
});
