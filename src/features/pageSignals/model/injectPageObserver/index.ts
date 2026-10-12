import { PAGE_OBSERVER_PATH } from "../../constants";
import type { PageSignalsApi } from "../../types";

/**
 * Starts observing the page a session tab shows, in its top frame only.
 *
 * Failing is ordinary rather than an error: page access may have been refused,
 * the page may be one no extension may script, or the tab may have moved on.
 * A page already observed ignores a second injection.
 *
 * @returns Whether the observer was injected.
 */
export const injectPageObserver = async (
  api: Pick<PageSignalsApi, "executeScript">,
  tabId: number,
): Promise<boolean> => {
  try {
    await api.executeScript({ target: { tabId, frameIds: [0] }, files: [PAGE_OBSERVER_PATH] });

    return true;
  } catch {
    return false;
  }
};
