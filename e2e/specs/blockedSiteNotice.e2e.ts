import { browser, expect } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickToolbarAction,
  closePopup,
  enterBrowserChrome,
  leaveBrowserChrome,
  loadUrlInSelectedTab,
  openTabOutsideGroups,
  placeToolbarAction,
  readNoticeInTabShowing,
  readPopup,
  readTabGroups,
  submitPopupGroupTitle,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";
import { DENYLISTED_TEST_HOST, PAGE_ORIGIN_VARIABLE } from "../fixtures/pageServer/constants";
import { putResearchRecords, readResearchDatabase } from "../fixtures/researchDatabase/utils";

const readOrigin = (): string => {
  const origin = process.env[PAGE_ORIGIN_VARIABLE];

  if (origin === undefined) {
    throw new Error(`${PAGE_ORIGIN_VARIABLE} is not set; the page server did not start.`);
  }

  return origin;
};

/** A page of the suite served under the denylisted host. */
const bankPage = (name: string): string =>
  `http://${DENYLISTED_TEST_HOST}:${new URL(readOrigin()).port}/${name}`;

// The notice that a denylisted site is not tracked: shown once per site in a
// session tab, not for a tab outside the session or once the user turned the
// notice off, and the visit leaves nothing recorded.
describe("the notice that a site is not tracked", () => {
  const title = `Blocked notice ${Date.now()}`;

  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await submitPopupGroupTitle(title);
    await browser.waitUntil(
      async () => (await readTabGroups()).some((group) => group.label === title),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: `No tab group titled "${title}" appeared.` },
    );
    await closePopup();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("is not shown once the user turned the notice off", async () => {
    await putResearchRecords("settings", [{ id: "user", isPageNoticeEnabled: false }]);
    await loadUrlInSelectedTab(bankPage("b.html"));
    await browser.pause(2_000);

    expect((await readNoticeInTabShowing("/b.html")).isShown).toBe(false);

    await putResearchRecords("settings", [{ id: "user", isPageNoticeEnabled: true }]);
  });

  it("is shown in the corner for a denylisted page, and takes no clicks", async () => {
    await loadUrlInSelectedTab(bankPage("a.html"));

    const notice = await browser.waitUntil(
      async () => {
        const snapshot = await readNoticeInTabShowing("/a.html");

        return snapshot.isShown ? snapshot : false;
      },
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "The bank's page never showed the notice." },
    );

    expect(notice).toEqual({
      isShown: true,
      position: "fixed",
      pointerEvents: "none",
      isOpen: false,
    });
  });

  it("is shown once for the site, not for its next page", async () => {
    await browser.waitUntil(async () => !(await readNoticeInTabShowing("/a.html")).isShown, {
      timeout: UI_TIMEOUT_MS,
      timeoutMsg: "The notice never went away.",
    });

    await loadUrlInSelectedTab(bankPage("c.html"));
    await browser.pause(2_000);

    expect((await readNoticeInTabShowing("/c.html")).isShown).toBe(false);
  });

  it("is not shown for a tab outside the session's group", async () => {
    await openTabOutsideGroups(
      `http://${DENYLISTED_TEST_HOST}:${new URL(readOrigin()).port}/b.html`,
    );
    await browser.pause(2_000);

    expect((await readNoticeInTabShowing("/b.html")).isShown).toBe(false);
  });

  it("leaves nothing recorded about the visits", async () => {
    const database = await readResearchDatabase();

    expect(database.nodes).toEqual([]);
    expect(database.snapshots).toEqual([]);
    expect(JSON.stringify(database)).not.toContain(DENYLISTED_TEST_HOST);
  });
});
