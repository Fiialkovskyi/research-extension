import { browser, expect } from "@wdio/globals";

import { TAB_GROUP_COLORS } from "@/features/tabGroups";

import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickToolbarAction,
  closePopup,
  enterBrowserChrome,
  leaveBrowserChrome,
  placeToolbarAction,
  readPopup,
  readTabGroups,
  submitPopupGroupTitle,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";

describe("starting a session from the popup", () => {
  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  afterEach(async () => {
    await closePopup();
  });

  it("creates a titled tab group holding one tab, coloured by Firefox", async () => {
    // Unique per run, so a group left behind by an earlier test cannot pass this one.
    const title = `Session ${Date.now()}`;

    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();

    await submitPopupGroupTitle(title);

    const group = await browser.waitUntil(
      async () => (await readTabGroups()).find((candidate) => candidate.label === title),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: `No tab group titled "${title}" appeared.` },
    );

    expect(group.tabCount).toBe(1);
    expect(TAB_GROUP_COLORS).toContain(group.color);
    expect((await readTabGroups()).filter((candidate) => candidate.label === title)).toHaveLength(
      1,
    );
  });
});
