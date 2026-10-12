import type { CaptureTab } from "../../types";

/**
 * The title to record for the page at `url` in `tab`.
 *
 * A tab reports a page's title only once the page has loaded; until then it
 * reports the previous page's, or none. So the tab's title is used only when
 * the tab already shows `url` and has one, and the URL stands in otherwise —
 * the real title follows when the tab reports it.
 */
export const readTabTitle = (tab: CaptureTab, url: string): string => {
  return tab.url === url && tab.title !== undefined && tab.title.trim() !== "" ? tab.title : url;
};
