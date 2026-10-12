import type { MapTab } from "../openMapTab";

/** A tab as the browser reports it, where even the id is optional. */
interface BrowserTab {
  id?: number;
  windowId?: number;
  url?: string;
  groupId?: number;
}

/**
 * Narrows a browser tab to what opening the map reads.
 *
 * A tab the browser reports without a group is in none.
 *
 * @throws If the tab has no id or window, as a few special tabs do; such a tab
 * is never the map's.
 */
export const readMapTab = ({ id, windowId, url, groupId }: BrowserTab): MapTab => {
  if (id === undefined || windowId === undefined) {
    throw new Error("The browser reported a tab without an id or a window.");
  }

  return { id, windowId, groupId: groupId ?? -1, ...(url === undefined ? {} : { url }) };
};
