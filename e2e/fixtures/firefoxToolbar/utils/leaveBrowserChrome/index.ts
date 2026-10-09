import { browser } from "@wdio/globals";

import { CONTENT_CONTEXT } from "../../constants";

/** Returns to the content context, where ordinary page commands work again. */
export const leaveBrowserChrome = async (): Promise<void> => {
  await browser.setMozContext(CONTENT_CONTEXT);
};
