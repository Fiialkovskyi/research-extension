import { browser } from "@wdio/globals";

import { PAGE_LOAD_TIMEOUT_MS } from "../../constants";
import { buildGroupPageOpenerScript } from "../buildGroupPageOpenerScript";
import { parseChromeResult } from "../parseChromeResult";

/**
 * Opens `url` as a new tab inside the group labelled `label`, as following a
 * link from a session tab would, and waits for it to load. Must be called in
 * the chrome context.
 *
 * @returns How many tabs the group holds afterwards.
 * @throws If no group carries the label, or the page does not load in time.
 */
export const openPageInGroup = async (label: string, url: string): Promise<number> => {
  const raw = await browser.executeAsyncScript(
    buildGroupPageOpenerScript(label, url, PAGE_LOAD_TIMEOUT_MS),
    [],
  );

  return parseChromeResult(raw) as number;
};
