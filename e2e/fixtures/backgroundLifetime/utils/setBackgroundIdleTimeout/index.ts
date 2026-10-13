import { browser } from "@wdio/globals";

import { IDLE_TIMEOUT_PREF } from "../../constants";

/**
 * Sets how long Firefox lets the event page sit idle before unloading it, or
 * restores the default with `undefined`. Must be called in the chrome context.
 */
export const setBackgroundIdleTimeout = async (timeoutMs: number | undefined): Promise<void> => {
  await (timeoutMs === undefined
    ? browser.executeScript(`Services.prefs.clearUserPref(arguments[0]);`, [IDLE_TIMEOUT_PREF])
    : browser.executeScript(`Services.prefs.setIntPref(arguments[0], arguments[1]);`, [
        IDLE_TIMEOUT_PREF,
        timeoutMs,
      ]));
};
