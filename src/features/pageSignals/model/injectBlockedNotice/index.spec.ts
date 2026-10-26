import { describe, expect, it, vi } from "vitest";

import { injectBlockedNotice } from ".";

describe("injectBlockedNotice", () => {
  it("injects the notice script into the tab's top frame only", async () => {
    const executeScript = vi.fn(() => Promise.resolve([]));

    expect(await injectBlockedNotice({ executeScript }, 7)).toBe(true);
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 7, frameIds: [0] },
      files: ["/content-scripts/blockedNotice.js"],
    });
  });

  it("resolves quietly when the page may not be scripted", async () => {
    const executeScript = vi.fn(() => Promise.reject(new Error("Missing host permission")));

    expect(await injectBlockedNotice({ executeScript }, 7)).toBe(false);
  });
});
