import { browser } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../../constants";
import { buildPopupReaderScript } from "../buildPopupReaderScript";
import { parseReaderResult } from "../parseReaderResult";
import { type PopupSnapshot, parsePopupSnapshot } from "../parsePopupSnapshot";

export type { PopupSnapshot };

/** Waits until the popup document is loaded in the panel, then reads it. */
export const readPopup = async (): Promise<PopupSnapshot> => {
  const script = buildPopupReaderScript();

  const raw = await browser.waitUntil(
    async () => parseReaderResult(await browser.executeAsyncScript(script, [])),
    { timeout: UI_TIMEOUT_MS, timeoutMsg: "The toolbar popup never rendered its document." },
  );

  return parsePopupSnapshot(raw);
};
