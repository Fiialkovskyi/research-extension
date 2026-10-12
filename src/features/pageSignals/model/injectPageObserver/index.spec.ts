import { describe, expect, it, vi } from "vitest";

import { injectPageObserver } from ".";

describe("injectPageObserver", () => {
  it("injects the observer into the tab's top frame only", async () => {
    const executeScript = vi.fn(() => Promise.resolve([]));

    expect(await injectPageObserver({ executeScript }, 7)).toBe(true);
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 7, frameIds: [0] },
      files: ["/content-scripts/pageObserver.js"],
    });
  });

  it("resolves quietly when the page may not be scripted", async () => {
    const executeScript = vi.fn(() => Promise.reject(new Error("Missing host permission")));

    expect(await injectPageObserver({ executeScript }, 7)).toBe(false);
  });
});
