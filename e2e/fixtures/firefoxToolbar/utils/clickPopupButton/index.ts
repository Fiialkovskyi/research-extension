import { browser } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../../constants";
import { buildPopupButtonClickScript } from "../buildPopupButtonClickScript";
import { buildPopupReaderScript } from "../buildPopupReaderScript";
import { parseReaderResult } from "../parseReaderResult";

/**
 * Clicks a button in the open popup by its test id.
 *
 * Reaches the popup the same way `readPopup` does, through Firefox's
 * Marionette actor. Must be called in the chrome context.
 *
 * @throws If the popup never loads, or it has no such button.
 */
export const clickPopupButton = async (testId: string): Promise<void> => {
  const script = buildPopupReaderScript(buildPopupButtonClickScript(testId));

  const raw = await browser.waitUntil(
    async () => parseReaderResult(await browser.executeAsyncScript(script, [])),
    { timeout: UI_TIMEOUT_MS, timeoutMsg: "The toolbar popup never rendered its document." },
  );

  if (!(JSON.parse(raw) as { clicked: boolean }).clicked) {
    throw new Error(`The popup has no button "${testId}".`);
  }
};
