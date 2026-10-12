/** A tab as far as finding and placing the map's tab needs it. */
export interface MapTab {
  id: number;
  windowId: number;
  url?: string;
  groupId: number;
}

/** The browser's tab calls that opening the map uses. */
export interface MapTabApi {
  /** Every tab in every window. */
  queryTabs: () => Promise<MapTab[]>;
  /** Opens a tab on `url`, related to no other tab. */
  createTab: (url: string) => Promise<MapTab>;
  /** Selects the tab and focuses its window. */
  focusTab: (tab: MapTab) => Promise<void>;
  ungroupTab: (tabId: number) => Promise<void>;
}

/** Firefox's `groupId` for a tab in no group. */
const NO_GROUP = -1;

/**
 * Selects the map's tab, or opens one when none is open.
 *
 * The open tab is found by URL prefix: a query by match pattern cannot name the
 * extension's own scheme. A new tab is opened unrelated to the selected one, so
 * Firefox does not put it beside a grouped tab, and is taken out of a group if
 * it lands in one anyway: capture would ignore it, but the user would see the
 * map as part of the research.
 */
export const openMapTab = async (api: MapTabApi, mapUrl: string): Promise<void> => {
  const tabs = await api.queryTabs();
  const open = tabs.find((tab) => tab.url?.startsWith(mapUrl) === true);

  if (open !== undefined) {
    await api.focusTab(open);
    return;
  }

  const created = await api.createTab(mapUrl);

  if (created.groupId !== NO_GROUP) {
    await api.ungroupTab(created.id);
  }
};
