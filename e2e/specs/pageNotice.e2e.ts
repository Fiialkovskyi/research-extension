import { browser, expect } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickToolbarAction,
  copyInTabShowing,
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
import { PAGE_ORIGIN_VARIABLE } from "../fixtures/pageServer/constants";
import { putResearchRecords, readResearchDatabase } from "../fixtures/researchDatabase/utils";

const readOrigin = (): string => {
  const origin = process.env[PAGE_ORIGIN_VARIABLE];

  if (origin === undefined) {
    throw new Error(`${PAGE_ORIGIN_VARIABLE} is not set; the page server did not start.`);
  }

  return origin;
};

// The notice that a page was added to research: shown once the page's text is
// taken, not for a page outside the session, and not once the user turned it off.
describe("the notice that a page was added to research", () => {
  const title = `Notice ${Date.now()}`;

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

  it("is not shown once the user turned it off", async () => {
    // The switch itself is covered by the options page's unit specs; this
    // checks what it does to a page.
    await putResearchRecords("settings", [{ id: "user", isPageNoticeEnabled: false }]);
    await loadUrlInSelectedTab(`${readOrigin()}/essay.html`);
    await browser.pause(1_500);
    await copyInTabShowing("/essay.html", "#headline");
    await browser.waitUntil(async () => (await readResearchDatabase()).snapshots.length > 0, {
      timeout: UI_TIMEOUT_MS,
      timeoutMsg: "The essay's text was never taken.",
    });
    await browser.pause(1_000);

    expect((await readNoticeInTabShowing("/essay.html")).isShown).toBe(false);

    await putResearchRecords("settings", [{ id: "user", isPageNoticeEnabled: true }]);
  });

  it("shows in the corner once the page's text is taken, takes no clicks, and hides its content", async () => {
    await loadUrlInSelectedTab(`${readOrigin()}/article.html`);
    await browser.pause(1_500);

    // Reading alone takes no text: the page is only visited.
    expect((await readNoticeInTabShowing("/article.html")).isShown).toBe(false);

    await copyInTabShowing("/article.html", "#headline");

    const notice = await browser.waitUntil(
      async () => {
        const snapshot = await readNoticeInTabShowing("/article.html");

        return snapshot.isShown ? snapshot : false;
      },
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "The page never showed the notice." },
    );

    expect(notice).toEqual({
      isShown: true,
      position: "fixed",
      pointerEvents: "none",
      // A closed shadow root: the page cannot read what the notice says.
      isOpen: false,
    });
  });

  it("goes away by itself", async () => {
    await browser.waitUntil(async () => !(await readNoticeInTabShowing("/article.html")).isShown, {
      timeout: UI_TIMEOUT_MS,
      timeoutMsg: "The notice never went away.",
    });
  });

  it("is not shown for a page outside the session's group", async () => {
    await openTabOutsideGroups(`${readOrigin()}/b.html`);
    await browser.pause(1_500);

    expect((await readNoticeInTabShowing("/b.html")).isShown).toBe(false);
  });
});
