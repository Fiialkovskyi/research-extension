import { SESSION_QUERY_PARAMETER } from "@/shared/config";

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

/** Whether `tabUrl` is `pageUrl`, for the session when there is one. */
const isOpenFor = (tabUrl: string | undefined, pageUrl: string, sessionId: string | undefined) => {
  if (tabUrl === undefined) {
    return false;
  }

  try {
    const open = new URL(tabUrl);
    const page = new URL(pageUrl);

    return (
      open.origin === page.origin &&
      open.pathname === page.pathname &&
      (sessionId === undefined || open.searchParams.get(SESSION_QUERY_PARAMETER) === sessionId)
    );
  } catch {
    return false;
  }
};

/**
 * Selects the page's tab, or opens one when none is open.
 *
 * With a `sessionId` the page is pinned to that session (`?session=<id>`), and
 * only a tab open for the same session counts: the same page for another
 * session opens a second tab. Without one, any tab of the page counts. The
 * open tab is found by comparing URLs, since a query by match pattern cannot
 * name the extension's own scheme. A new tab is opened unrelated to the
 * selected one, so Firefox does not put it beside a grouped tab, and is taken
 * out of a group if it lands in one anyway: capture would ignore it, but the
 * user would see the page as part of the research.
 */
export const openMapTab = async (
  api: MapTabApi,
  mapUrl: string,
  sessionId?: string,
): Promise<void> => {
  const tabs = await api.queryTabs();
  const open = tabs.find((tab) => isOpenFor(tab.url, mapUrl, sessionId));

  if (open !== undefined) {
    await api.focusTab(open);
    return;
  }

  const url =
    sessionId === undefined
      ? mapUrl
      : `${mapUrl}?${SESSION_QUERY_PARAMETER}=${encodeURIComponent(sessionId)}`;
  const created = await api.createTab(url);

  if (created.groupId !== NO_GROUP) {
    await api.ungroupTab(created.id);
  }
};
