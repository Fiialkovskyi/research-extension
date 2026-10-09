import { browser } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../../constants";
import { buildGroupTitleSubmitScript } from "../buildGroupTitleSubmitScript";
import { buildPopupReaderScript } from "../buildPopupReaderScript";
import { parseReaderResult } from "../parseReaderResult";

/**
 * Types a session title into the open popup and submits it.
 *
 * Reaches the popup the same way `readPopup` does, through Firefox's
 * Marionette actor, because the popup's document is out of reach otherwise.
 *
 * @throws If the popup never loads, or it has no session form to submit.
 */
export const submitPopupGroupTitle = async (title: string): Promise<void> => {
  const script = buildPopupReaderScript(buildGroupTitleSubmitScript(title));

  const raw = await browser.waitUntil(
    async () => parseReaderResult(await browser.executeAsyncScript(script, [])),
    { timeout: UI_TIMEOUT_MS, timeoutMsg: "The toolbar popup never rendered its document." },
  );

  if (!(JSON.parse(raw) as { submitted: boolean }).submitted) {
    throw new Error("The popup has no session form to submit.");
  }
};
