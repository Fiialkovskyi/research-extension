import { browser } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../../constants";
import { buildPopupReaderScript } from "../buildPopupReaderScript";
import { buildPopupSessionSelectScript } from "../buildPopupSessionSelectScript";
import { parseReaderResult } from "../parseReaderResult";

/**
 * Chooses a saved session in the open popup's session picker, by (part of) the
 * title its option shows.
 *
 * Reaches the popup the same way `readPopup` does. Must be called in the
 * chrome context.
 *
 * @throws If the popup never loads, or its picker has no such session.
 */
export const selectPopupSession = async (title: string): Promise<void> => {
  const script = buildPopupReaderScript(buildPopupSessionSelectScript(title));

  const raw = await browser.waitUntil(
    async () => parseReaderResult(await browser.executeAsyncScript(script, [])),
    { timeout: UI_TIMEOUT_MS, timeoutMsg: "The toolbar popup never rendered its document." },
  );

  if (!(JSON.parse(raw) as { selected: boolean }).selected) {
    throw new Error(`The popup's session picker has no session "${title}".`);
  }
};
