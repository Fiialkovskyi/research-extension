import { browser } from "@wdio/globals";

import { DARK_THEME_PREF } from "../constants";
import { type SystemColourScheme, getDarkThemePrefValue } from "./utils/getDarkThemePrefValue";

export type { SystemColourScheme };

/** Overrides the colour scheme the operating system is reported to prefer. */
export async function setSystemColourScheme(scheme: SystemColourScheme): Promise<void> {
  await browser.executeScript(`Services.prefs.setIntPref(arguments[0], arguments[1]);`, [
    DARK_THEME_PREF,
    getDarkThemePrefValue(scheme),
  ]);
}
