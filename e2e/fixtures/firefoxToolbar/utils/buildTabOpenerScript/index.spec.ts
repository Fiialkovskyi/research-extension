import { describe, expect, it, vi } from "vitest";

import { buildTabOpenerScript } from ".";

describe("buildTabOpenerScript", () => {
  it("opens the URL in a new, ungrouped tab", () => {
    const gBrowser = { addTrustedTab: vi.fn() };

    new Function("gBrowser", buildTabOpenerScript('http://x/"a".html'))(gBrowser);

    expect(gBrowser.addTrustedTab).toHaveBeenCalledWith('http://x/"a".html');
  });
});
