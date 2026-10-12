import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { browser, expect } from "@wdio/globals";

import { HEADLESS } from "../fixtures/firefoxExtension/constants";
import {
  buildFirefoxCapabilities,
  RESTART_PREFERENCES,
  restartFirefox,
} from "../fixtures/firefoxExtension/utils";
import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickToolbarAction,
  closePopup,
  enterBrowserChrome,
  leaveBrowserChrome,
  loadUrlInSelectedTab,
  placeToolbarAction,
  readPopup,
  readTabGroups,
  submitPopupGroupTitle,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";
import { PAGE_ORIGIN_VARIABLE } from "../fixtures/pageServer/constants";
import { readResearchDatabase } from "../fixtures/researchDatabase/utils";

describe("a session across a Firefox restart", () => {
  // A kept profile with session restore on: the throwaway profile the suite
  // normally runs in would come back empty.
  const capabilities = buildFirefoxCapabilities({
    headless: HEADLESS,
    profileDirectory: mkdtempSync(join(tmpdir(), "research-graph-profile-")),
    preferences: RESTART_PREFERENCES,
  });

  before(async () => {
    await restartFirefox(capabilities);
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("is still active after the restart, following the same group and pages", async () => {
    const title = `Restart ${Date.now()}`;

    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await submitPopupGroupTitle(title);
    await browser.waitUntil(
      async () => (await readTabGroups()).some((group) => group.label === title),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: `No tab group titled "${title}" appeared.` },
    );
    await closePopup();
    await loadUrlInSelectedTab(`${process.env[PAGE_ORIGIN_VARIABLE]}/a.html`);

    const before = await browser.waitUntil(
      async () => {
        const snapshot = await readResearchDatabase();
        return snapshot.nodes.length === 1 ? snapshot : false;
      },
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "The session's page was never recorded." },
    );

    await leaveBrowserChrome();
    await restartFirefox(capabilities);
    await enterBrowserChrome();
    await placeToolbarAction();

    const after = await browser.waitUntil(
      async () => {
        const snapshot = await readResearchDatabase();
        return snapshot.groups.some((group) => group.title === title) ? snapshot : false;
      },
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "The session's group did not come back." },
    );

    expect(after.sessions).toEqual([expect.objectContaining({ title, status: "active" })]);
    expect(after.groups.find((group) => group.title === title)?.id).toBe(
      before.sessions[0]?.groupId,
    );
    // Reconciled on waking: the restored tab's page is the one open node.
    expect(after.nodes.filter((node) => node.tabState === "open")).toEqual([
      expect.objectContaining({ url: expect.stringMatching(/\/a\.html$/) }),
    ]);

    await clickToolbarAction();
    await waitForPopupPanel();

    expect((await readPopup()).activeSession).toContain(title);

    await closePopup();
  });
});
