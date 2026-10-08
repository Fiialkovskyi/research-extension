import { browser } from "@wdio/globals";

import { EXTENSION_ID } from "@/shared/config/extension";

import { ELEMENT_KEY } from "../constants";
import { getToolbarWidgetId } from "../getToolbarWidgetId";
import { buildPointerClickActions } from "./utils/buildPointerClickActions";

/** Clicks the toolbar icon with a real pointer gesture, as a person would. */
export async function clickToolbarAction(): Promise<void> {
  const widgetId = getToolbarWidgetId(EXTENSION_ID);
  const element = (await browser.findElement("css selector", `#${widgetId}`)) as Record<
    string,
    string
  >;
  const elementId = element[ELEMENT_KEY];

  if (elementId === undefined) {
    throw new Error(`Toolbar action #${widgetId} is not in the chrome DOM.`);
  }

  await browser.performActions(buildPointerClickActions(elementId));
}
