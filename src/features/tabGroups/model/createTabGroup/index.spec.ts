import { describe, expect, it, vi } from "vitest";

import { createTabGroup } from ".";
import type { TabGroupApi } from "../../types";

const TAB_ID = 7;
const GROUP_ID = 42;

/** An API that succeeds, recording every call in order. */
const createApi = (overrides: Partial<TabGroupApi> = {}) => {
  const calls: string[] = [];
  const record =
    <T>(name: string, result: T) =>
    () => {
      calls.push(name);
      return Promise.resolve(result);
    };

  const api: TabGroupApi = {
    createTab: vi.fn(record("createTab", { id: TAB_ID })),
    groupTabs: vi.fn(record("groupTabs", GROUP_ID)),
    updateGroup: vi.fn(record("updateGroup", undefined)),
    getGroup: vi.fn(record("getGroup", { color: "cyan" })),
    activateTab: vi.fn(record("activateTab", undefined)),
    removeTab: vi.fn(record("removeTab", undefined)),
    ...overrides,
  };

  return { api, calls };
};

describe("createTabGroup", () => {
  it("creates the tab hidden, groups and titles it, and focuses it last", async () => {
    const { api, calls } = createApi();

    await createTabGroup({ title: "E-bike motors", api });

    expect(calls).toEqual(["createTab", "groupTabs", "updateGroup", "getGroup", "activateTab"]);
    expect(api.createTab).toHaveBeenCalledWith({ active: false });
    expect(api.groupTabs).toHaveBeenCalledWith({ tabIds: [TAB_ID] });
    expect(api.updateGroup).toHaveBeenCalledWith(GROUP_ID, { title: "E-bike motors" });
    expect(api.activateTab).toHaveBeenCalledWith(TAB_ID);
  });

  it("reports the colour Firefox assigned, read back from the group", async () => {
    const { api } = createApi();

    expect(await createTabGroup({ title: "E-bike motors", api })).toEqual({
      groupId: GROUP_ID,
      tabId: TAB_ID,
      title: "E-bike motors",
      color: "cyan",
    });
  });

  it.each(["groupTabs", "updateGroup", "getGroup"] as const)(
    "closes the tab and never focuses it when %s fails",
    async (failing) => {
      const { api } = createApi({ [failing]: vi.fn().mockRejectedValue(new Error("refused")) });

      await expect(createTabGroup({ title: "E-bike motors", api })).rejects.toThrow("refused");

      expect(api.removeTab).toHaveBeenCalledWith(TAB_ID);
      expect(api.activateTab).not.toHaveBeenCalled();
    },
  );

  it("treats a colour outside the known set as a failure, rolling back", async () => {
    const { api } = createApi({ getGroup: vi.fn().mockResolvedValue({ color: "magenta" }) });

    await expect(createTabGroup({ title: "E-bike motors", api })).rejects.toThrow();

    expect(api.removeTab).toHaveBeenCalledWith(TAB_ID);
    expect(api.activateTab).not.toHaveBeenCalled();
  });

  it("fails before grouping when the browser returns a tab without an id", async () => {
    const { api } = createApi({ createTab: vi.fn().mockResolvedValue({}) });

    await expect(createTabGroup({ title: "E-bike motors", api })).rejects.toThrow("without an id");

    expect(api.groupTabs).not.toHaveBeenCalled();
  });
});
