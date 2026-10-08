import { browser } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../constants";
import { buildPopupReaderScript } from "./utils/buildPopupReaderScript";
import { interpretReaderResult } from "./utils/interpretReaderResult";
import { type PopupSnapshot, parsePopupSnapshot } from "./utils/parsePopupSnapshot";

export type { PopupSnapshot };

/** Waits until the popup document is loaded in the panel, then reads it. */
export async function readPopup(): Promise<PopupSnapshot> {
  const script = buildPopupReaderScript();

  const raw = await browser.waitUntil(
    async () => interpretReaderResult(await browser.executeAsyncScript(script, [])),
    { timeout: UI_TIMEOUT_MS, timeoutMsg: "The toolbar popup never rendered its document." },
  );

  return parsePopupSnapshot(raw);
}
