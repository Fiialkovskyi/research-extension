import { browser } from "@wdio/globals";

import { DARK_THEME_PREF } from "../../constants";
import { type SystemColorScheme, getDarkThemePrefValue } from "../getDarkThemePrefValue";

export type { SystemColorScheme };

/** Overrides the colour scheme the operating system is reported to prefer. */
export const setSystemColorScheme = async (scheme: SystemColorScheme): Promise<void> => {
  await browser.executeScript(`Services.prefs.setIntPref(arguments[0], arguments[1]);`, [
    DARK_THEME_PREF,
    getDarkThemePrefValue(scheme),
  ]);
};
