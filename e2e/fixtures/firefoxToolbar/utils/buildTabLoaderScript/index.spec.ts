import { describe, expect, it, vi } from "vitest";

import { buildTabLoaderScript } from ".";

describe("buildTabLoaderScript", () => {
  it("loads the URL into the current tab", () => {
    const openTrustedLinkIn = vi.fn();

    new Function("openTrustedLinkIn", buildTabLoaderScript("http://127.0.0.1:1/a.html"))(
      openTrustedLinkIn,
    );

    expect(openTrustedLinkIn).toHaveBeenCalledWith("http://127.0.0.1:1/a.html", "current");
  });

  it("keeps a URL with quotes inside the string it loads", () => {
    const openTrustedLinkIn = vi.fn();

    new Function("openTrustedLinkIn", buildTabLoaderScript('http://x/"q".html'))(openTrustedLinkIn);

    expect(openTrustedLinkIn).toHaveBeenCalledWith('http://x/"q".html', "current");
  });
});
