import { describe, expect, it, vi } from "vitest";

import { closeTabsKeepingWindow } from ".";

const buildApi = (windowTabs: number[]) => ({
  queryWindowTabIds: vi.fn(() => Promise.resolve(windowTabs)),
  createTabIn: vi.fn(() => Promise.resolve()),
  removeTabs: vi.fn(() => Promise.resolve()),
});

describe("closeTabsKeepingWindow", () => {
  it("closes the tabs when their window keeps others", async () => {
    const api = buildApi([1, 7, 9]);

    await closeTabsKeepingWindow(api, [
      { id: 7, windowId: 1 },
      { id: 9, windowId: 1 },
    ]);

    expect(api.createTabIn).not.toHaveBeenCalled();
    expect(api.removeTabs).toHaveBeenCalledWith([7, 9]);
  });

  it("opens a new tab first when they are every tab of their window", async () => {
    const api = buildApi([7, 9]);
    const order: string[] = [];

    api.createTabIn.mockImplementation(() => {
      order.push("create");
      return Promise.resolve();
    });
    api.removeTabs.mockImplementation(() => {
      order.push("remove");
      return Promise.resolve();
    });

    await closeTabsKeepingWindow(api, [
      { id: 7, windowId: 1 },
      { id: 9, windowId: 1 },
    ]);

    expect(api.createTabIn).toHaveBeenCalledWith(1);
    expect(order).toEqual(["create", "remove"]);
  });

  it("does nothing with no tabs", async () => {
    const api = buildApi([]);

    await closeTabsKeepingWindow(api, []);

    expect(api.removeTabs).not.toHaveBeenCalled();
  });
});
