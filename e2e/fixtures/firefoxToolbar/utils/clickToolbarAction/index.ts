import { browser } from "@wdio/globals";
import * as v from "valibot";

import { EXTENSION_ID } from "@/shared/config";

import { ELEMENT_KEY } from "../../constants";
import { getToolbarWidgetId } from "../getToolbarWidgetId";
import { elementReferenceSchema } from "./schemas";
import { buildPointerClickActions } from "../buildPointerClickActions";

/** Clicks the toolbar icon with a real pointer gesture, as a person would. */
export const clickToolbarAction = async (): Promise<void> => {
  const widgetId = getToolbarWidgetId(EXTENSION_ID);
  const element = await browser.findElement("css selector", `#${widgetId}`);
  const reference = v.safeParse(elementReferenceSchema, element);
  const elementId = reference.success ? reference.output[ELEMENT_KEY] : undefined;

  if (elementId === undefined) {
    throw new Error(`Toolbar action #${widgetId} is not in the chrome DOM.`);
  }

  await browser.performActions(buildPointerClickActions(elementId));
};
