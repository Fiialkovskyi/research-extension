import { browser } from "@wdio/globals";

import { EXTENSION_ID } from "@/shared/config";

import { getToolbarWidgetId } from "../getToolbarWidgetId";
import { assertPlacedOnNavBar } from "../assertPlacedOnNavBar";

/** Privileged script that places the widget and reports where it landed. */
const PLACE_WIDGET_SCRIPT = `CustomizableUI.addWidgetToArea(arguments[0], CustomizableUI.AREA_NAVBAR);
     return CustomizableUI.getPlacementOfWidget(arguments[0])?.area ?? null;`;

/** Makes sure the extension's action sits on the navigation toolbar. */
export const placeToolbarAction = async (): Promise<void> => {
  assertPlacedOnNavBar(
    await browser.executeScript(PLACE_WIDGET_SCRIPT, [getToolbarWidgetId(EXTENSION_ID)]),
  );
};
