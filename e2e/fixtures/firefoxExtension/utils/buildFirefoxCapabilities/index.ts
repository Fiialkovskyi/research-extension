import { buildProfilePreferences } from "../buildProfilePreferences";

export interface FirefoxCapabilityOptions {
  headless: boolean;
  /**
   * A profile directory to run in and keep. Without one, geckodriver creates a
   * throwaway profile per session, so nothing survives a restart.
   */
  profileDirectory?: string;
  /** Preferences beyond the ones every session needs. */
  preferences?: Record<string, boolean | number | string>;
}

/**
 * Preferences a profile needs to come back from a restart the way a user's
 * does: the previous session restored, and the temporarily installed add-on's
 * data and address kept, because a temporary add-on is removed when Firefox
 * quits and has to be installed again.
 */
export const RESTART_PREFERENCES = {
  "browser.startup.page": 3,
  "extensions.webextensions.keepStorageOnUninstall": true,
  "extensions.webextensions.keepUuidOnUninstall": true,
} as const;

/** Builds the capabilities a Firefox session of the suite starts with. */
export const buildFirefoxCapabilities = ({
  headless,
  profileDirectory,
  preferences = {},
}: FirefoxCapabilityOptions): WebdriverIO.Capabilities => {
  return {
    browserName: "firefox",
    // `allowSystemAccess` is not in the typed geckodriver options, but the
    // wrapper turns any camelCase key into a CLI flag, so this becomes
    // `--allow-system-access`, without which Marionette refuses to enter the
    // chrome context where the toolbar lives.
    "wdio:geckodriverOptions": { allowSystemAccess: true } as never,
    "moz:firefoxOptions": {
      args: [
        ...(headless ? ["-headless"] : []),
        ...(profileDirectory === undefined ? [] : ["-profile", profileDirectory]),
      ],
      prefs: { ...buildProfilePreferences(), ...preferences },
    },
  };
};
