import { browser } from "@wdio/globals";

import { buildProfilePreferences, readFirefoxZipAsBase64 } from "./fixtures/firefoxExtension/utils";

const headless = process.env.E2E_HEADED !== "true";

export const config: WebdriverIO.Config = {
  runner: "local",
  specs: ["./specs/**/*.e2e.ts"],
  maxInstances: 1,
  capabilities: [
    {
      browserName: "firefox",
      // `allowSystemAccess` is not in the typed geckodriver options, but the
      // wrapper turns any camelCase key into a CLI flag, so this becomes
      // `--allow-system-access`, without which Marionette refuses to enter the
      // chrome context where the toolbar lives.
      "wdio:geckodriverOptions": { allowSystemAccess: true } as never,
      "moz:firefoxOptions": {
        args: headless ? ["-headless"] : [],
        prefs: { ...buildProfilePreferences() },
      },
    },
  ],
  logLevel: "error",
  waitforTimeout: 10_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 3,
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    // The offline suite is fast and a tight bound catches hangs early. The
    // opt-in network run fetches tens of megabytes and then embeds on a
    // single thread, so it needs room without slowing failure detection for
    // everything else.
    timeout: process.env["E2E_NETWORK"] === "true" ? 900_000 : 60_000,
  },

  /**
   * Installs the packaged build temporarily. Temporary installation is what
   * lets an unsigned local build load into a release Firefox at all.
   */
  before: async () => {
    await browser.installAddOn(readFirefoxZipAsBase64(), true);
  },
};
