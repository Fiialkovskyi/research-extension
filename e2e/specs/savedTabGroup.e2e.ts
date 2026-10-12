import { browser, expect } from "@wdio/globals";

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
  reopenSavedTabGroup,
  saveAndCloseTabGroup,
  submitPopupGroupTitle,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";
import { PAGE_ORIGIN_VARIABLE } from "../fixtures/pageServer/constants";
import { readResearchDatabase } from "../fixtures/researchDatabase/utils";

describe("a session whose group is saved and closed", () => {
  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("closes, and reopens when its group comes back from the saved list under the same id", async () => {
    const title = `Saved ${Date.now()}`;
    const pageUrl = `${process.env[PAGE_ORIGIN_VARIABLE]}/a.html`;

    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await submitPopupGroupTitle(title);
    await browser.waitUntil(
      async () => (await readTabGroups()).some((group) => group.label === title),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: `No tab group titled "${title}" appeared.` },
    );
    await closePopup();

    // A group of only a new-tab page is not worth saving to Firefox; a web
    // page makes it a group a user would save.
    await loadUrlInSelectedTab(pageUrl);
    await browser.waitUntil(async () => (await readResearchDatabase()).nodes.length === 1, {
      timeout: UI_TIMEOUT_MS,
      timeoutMsg: "The session's page was never recorded.",
    });

    const savedId = await saveAndCloseTabGroup(title);

    // Closed rather than ended: Firefox reports a saved group like a deleted one.
    const closed = await browser.waitUntil(
      async () => {
        const snapshot = await readResearchDatabase();
        return snapshot.sessions[0]?.status === "closed" ? snapshot : false;
      },
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "The session did not close when its group was saved." },
    );
    const groupId = closed.sessions[0]?.groupId;

    expect(await reopenSavedTabGroup(savedId)).toBe(savedId);

    const reopened = await browser.waitUntil(
      async () => {
        const snapshot = await readResearchDatabase();
        const isBack =
          snapshot.groups.some((group) => group.title === title) &&
          snapshot.sessions[0]?.status === "active" &&
          snapshot.nodes.some((node) => node.tabState === "open");

        return isBack ? snapshot : false;
      },
      {
        timeout: UI_TIMEOUT_MS,
        timeoutMsg: "The reopened group never made the session active with its page open.",
      },
    );

    // The extension sees the reopened group under the id it recorded, which is
    // what lets the session recognise it.
    expect(reopened.groups.find((group) => group.title === title)?.id).toBe(groupId);
    expect(reopened.sessions.map((session) => session.status)).toEqual(["active"]);
    // The page's tab came back under a new id: its old node is closed, and the
    // restored tab has the one open node.
    expect(
      reopened.nodes.filter((node) => node.url === pageUrl && node.tabState === "open"),
    ).toHaveLength(1);
  });
});
