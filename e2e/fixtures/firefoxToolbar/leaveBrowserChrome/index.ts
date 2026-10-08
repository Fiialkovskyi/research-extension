import { browser } from "@wdio/globals";

import { CONTENT_CONTEXT } from "../constants";

/** Returns to the content context, where ordinary page commands work again. */
export async function leaveBrowserChrome(): Promise<void> {
  await browser.setMozContext(CONTENT_CONTEXT);
}
