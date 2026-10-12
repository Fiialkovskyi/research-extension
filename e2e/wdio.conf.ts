import { browser } from "@wdio/globals";

import { HEADLESS } from "./fixtures/firefoxExtension/constants";
import {
  buildFirefoxCapabilities,
  readFirefoxZipAsBase64,
} from "./fixtures/firefoxExtension/utils";
import { PAGE_ORIGIN_VARIABLE, PAGES_DIRECTORY } from "./fixtures/pageServer/constants";
import { type PageServer, startPageServer } from "./fixtures/pageServer/utils";

/** The offline page server, started once for the whole run. */
let pageServer: PageServer | undefined;

export const config: WebdriverIO.Config = {
  runner: "local",
  specs: ["./specs/**/*.e2e.ts"],
  maxInstances: 1,
  capabilities: [buildFirefoxCapabilities({ headless: HEADLESS })],
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
   * Starts the offline page server the capture suite browses. Its origin
   * reaches the workers through the environment, which they inherit from this
   * launcher process.
   */
  onPrepare: async () => {
    pageServer = await startPageServer(PAGES_DIRECTORY);
    process.env[PAGE_ORIGIN_VARIABLE] = pageServer.origin;
  },

  onComplete: async () => {
    await pageServer?.close();
  },

  /**
   * Installs the packaged build temporarily. Temporary installation is what
   * lets an unsigned local build load into a release Firefox at all.
   */
  before: async () => {
    await browser.installAddOn(readFirefoxZipAsBase64(), true);
  },
};
