import { browser } from "@wdio/globals";

import { DARK_THEME_PREF } from "../constants";

/**
 * Hands the colour-scheme decision back to the operating system.
 *
 * Different from setting light: it restores whatever the machine actually
 * prefers, which is what one test owes the next.
 */
export async function clearSystemColourScheme(): Promise<void> {
  await browser.executeScript(`Services.prefs.clearUserPref(arguments[0]);`, [DARK_THEME_PREF]);
}
