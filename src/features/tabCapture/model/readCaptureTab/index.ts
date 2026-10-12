import type { CaptureTab } from "../../types";

/** A tab as the browser reports it, where even the id is optional. */
interface BrowserTab {
  id?: number;
  url?: string;
  title?: string;
  groupId?: number;
  openerTabId?: number;
  windowId?: number;
  incognito: boolean;
}

/**
 * Narrows a browser tab to what capture reads.
 *
 * The browser types every tab id as optional because a few special tabs (dev
 * tools, for one) have none. Such a tab can never be in a session, so it is
 * refused here rather than checked by every rule.
 *
 * @throws If the tab has no id.
 */
export const readCaptureTab = ({
  id,
  url,
  title,
  groupId,
  openerTabId,
  windowId,
  incognito,
}: BrowserTab): CaptureTab => {
  if (id === undefined) {
    throw new Error("The browser reported a tab without an id.");
  }

  return {
    id,
    incognito,
    ...(url === undefined ? {} : { url }),
    ...(title === undefined ? {} : { title }),
    ...(groupId === undefined ? {} : { groupId }),
    ...(openerTabId === undefined ? {} : { openerTabId }),
    ...(windowId === undefined ? {} : { windowId }),
  };
};
