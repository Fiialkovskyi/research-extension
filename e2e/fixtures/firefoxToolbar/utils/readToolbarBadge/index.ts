import { browser } from "@wdio/globals";

import { EXTENSION_ID } from "@/shared/config";
import { buildToolbarBadgeReaderScript } from "../buildToolbarBadgeReaderScript";
import { getToolbarWidgetId } from "../getToolbarWidgetId";

/** The badge text on the add-on's toolbar button; empty without one. Must be called in the chrome context. */
export const readToolbarBadge = async (): Promise<string> =>
  String(
    await browser.executeScript(
      buildToolbarBadgeReaderScript(getToolbarWidgetId(EXTENSION_ID)),
      [],
    ),
  );
