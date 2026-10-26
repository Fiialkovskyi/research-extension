import { BLOCKED_NOTICE_PATH } from "../../constants";
import type { PageSignalsApi } from "../../types";

/**
 * Puts the blocked-site notice script into a session tab's top frame, to draw
 * one notice. The script reads nothing from the page and sends nothing; it
 * only waits to be asked to show the notice.
 *
 * Failing is ordinary: the page may be one no extension may script, or the tab
 * may have moved on.
 *
 * @returns Whether the script was injected.
 */
export const injectBlockedNotice = async (
  api: Pick<PageSignalsApi, "executeScript">,
  tabId: number,
): Promise<boolean> => {
  try {
    await api.executeScript({ target: { tabId, frameIds: [0] }, files: [BLOCKED_NOTICE_PATH] });

    return true;
  } catch {
    return false;
  }
};
