import { browser, expect } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickPopupButton,
  clickToolbarAction,
  closePopup,
  enterBrowserChrome,
  leaveBrowserChrome,
  placeToolbarAction,
  readPopup,
  readTabs,
  readToolbarBadge,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";

// A fresh install tells the user that AI needs setting up without stopping
// them: a badge on the icon, a banner in the popup, and one click to the setup page.
describe("AI setup on a fresh install", () => {
  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("badges the toolbar icon", async () => {
    await browser.waitUntil(async () => (await readToolbarBadge()) === "!", {
      timeout: UI_TIMEOUT_MS,
      timeoutMsg: "The toolbar icon never carried the setup badge.",
    });
  });

  it("shows the setup banner above the popup's content, and opens the setup page from it", async () => {
    await clickToolbarAction();
    await waitForPopupPanel();

    await browser.waitUntil(async () => (await readPopup()).setupBanner !== null, {
      timeout: UI_TIMEOUT_MS,
      timeoutMsg: "The popup never showed the setup banner.",
    });

    const popup = await readPopup();

    expect(popup.setupBanner).toContain("AI isn't set up");
    // Setting up is not required to start: the form is still offered.
    expect(popup.hasSessionForm).toBe(true);

    await clickPopupButton("setup-banner-action");
    await closePopup();

    await browser.waitUntil(
      async () => (await readTabs()).some((tab) => tab.url.endsWith("/setup.html")),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "The setup page never opened." },
    );
  });
});
