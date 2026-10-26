import { describe, expect, it, vi } from "vitest";

import { type MapTab, type MapTabApi, openMapTab } from ".";

const MAP_URL = "moz-extension://uuid/map.html";

const buildTab = (overrides: Partial<MapTab> = {}): MapTab => ({
  id: 1,
  windowId: 1,
  url: "https://example.org/",
  groupId: -1,
  ...overrides,
});

const createApi = (tabs: MapTab[], created: MapTab = buildTab({ id: 9, url: MAP_URL })) => {
  return {
    queryTabs: vi.fn(async () => tabs),
    createTab: vi.fn(async () => created),
    focusTab: vi.fn(async () => {}),
    ungroupTab: vi.fn(async () => {}),
  } satisfies MapTabApi;
};

describe("openMapTab", () => {
  it("selects the map tab that is already open, opening no other", async () => {
    const map = buildTab({ id: 4, windowId: 2, url: `${MAP_URL}#top` });
    const api = createApi([buildTab(), map]);

    await openMapTab(api, MAP_URL);

    expect(api.focusTab).toHaveBeenCalledWith(map);
    expect(api.createTab).not.toHaveBeenCalled();
  });

  it("opens the map when no map tab is open", async () => {
    const api = createApi([buildTab()]);

    await openMapTab(api, MAP_URL);

    expect(api.createTab).toHaveBeenCalledWith(MAP_URL);
    expect(api.ungroupTab).not.toHaveBeenCalled();
  });

  it("takes a new map tab out of the group it landed in", async () => {
    const api = createApi([], buildTab({ id: 9, url: MAP_URL, groupId: 42 }));

    await openMapTab(api, MAP_URL);

    expect(api.ungroupTab).toHaveBeenCalledWith(9);
  });

  it("does not mistake a tab without a known URL for the map", async () => {
    const { url: _url, ...withoutUrl } = buildTab();
    const api = createApi([withoutUrl]);

    await openMapTab(api, MAP_URL);

    expect(api.createTab).toHaveBeenCalledTimes(1);
  });

  it("selects the page already open for the same session", async () => {
    const open = buildTab({ id: 4, url: `${MAP_URL}?session=a` });
    const api = createApi([buildTab(), open]);

    await openMapTab(api, MAP_URL, "a");

    expect(api.focusTab).toHaveBeenCalledWith(open);
    expect(api.createTab).not.toHaveBeenCalled();
  });

  it("opens a second tab of the page for another session", async () => {
    const api = createApi([buildTab({ id: 4, url: `${MAP_URL}?session=a` })]);

    await openMapTab(api, MAP_URL, "b");

    expect(api.createTab).toHaveBeenCalledWith(`${MAP_URL}?session=b`);
    expect(api.focusTab).not.toHaveBeenCalled();
  });

  it("does not mistake the page of a longer path for the same page", async () => {
    const api = createApi([buildTab({ id: 4, url: `${MAP_URL}x?session=a` })]);

    await openMapTab(api, MAP_URL, "a");

    expect(api.createTab).toHaveBeenCalledTimes(1);
  });
});
