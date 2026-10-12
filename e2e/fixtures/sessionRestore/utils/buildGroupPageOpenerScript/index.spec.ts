import { describe, expect, it, vi } from "vitest";

import { buildGroupPageOpenerScript } from ".";

interface StubTab {
  linkedBrowser: { currentURI: { spec: string }; webProgress: { isLoadingDocument: boolean } };
}

/** Runs the script against stand-ins for `gBrowser` and `Services`. */
const run = (gBrowser: unknown, timeoutMs = 1000): Promise<unknown> => {
  return new Promise((resolve) => {
    const Services = { scriptSecurityManager: { getSystemPrincipal: () => "system" } };
    const script = new Function(
      "gBrowser",
      "Services",
      buildGroupPageOpenerScript("Motors", "http://127.0.0.1/a", timeoutMs),
    );

    script(gBrowser, Services, (raw: string) => resolve(JSON.parse(raw)));
  });
};

const createTab = (spec: string, loading: boolean): StubTab => ({
  linkedBrowser: { currentURI: { spec }, webProgress: { isLoadingDocument: loading } },
});

describe("buildGroupPageOpenerScript", () => {
  it("opens the page inside the group and answers the group's tab count once loaded", async () => {
    const tab = createTab("http://127.0.0.1/a", false);
    const group = {
      label: "Motors",
      tabs: [{}],
      addTabs: vi.fn((tabs: object[]) => group.tabs.push(...tabs)),
    };
    const gBrowser = { tabGroups: [group], addTab: vi.fn(() => tab) };

    expect(await run(gBrowser)).toEqual({ ok: 2 });
    expect(gBrowser.addTab).toHaveBeenCalledWith("http://127.0.0.1/a", {
      triggeringPrincipal: "system",
    });
    expect(group.addTabs).toHaveBeenCalledWith([tab]);
  });

  it("answers an error when no group carries the label", async () => {
    expect(await run({ tabGroups: [] })).toEqual({ error: 'No tab group titled "Motors".' });
  });

  it("answers an error when the page never finishes loading", async () => {
    const tab = createTab("about:blank", true);
    const group = { label: "Motors", tabs: [], addTabs: vi.fn() };

    expect(await run({ tabGroups: [group], addTab: () => tab }, 0)).toEqual({
      error: "The page http://127.0.0.1/a never finished loading.",
    });
  });
});
