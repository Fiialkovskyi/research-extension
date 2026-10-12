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

  it("ends, and its group comes back from the saved list under the same id", async () => {
    const title = `Saved ${Date.now()}`;

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
    await loadUrlInSelectedTab(`${process.env[PAGE_ORIGIN_VARIABLE]}/a.html`);
    await browser.waitUntil(async () => (await readResearchDatabase()).nodes.length === 1, {
      timeout: UI_TIMEOUT_MS,
      timeoutMsg: "The session's page was never recorded.",
    });

    const savedId = await saveAndCloseTabGroup(title);

    const ended = await browser.waitUntil(
      async () => {
        const snapshot = await readResearchDatabase();
        return snapshot.sessions[0]?.status === "saved" ? snapshot : false;
      },
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "The session did not end when its group was saved." },
    );
    const groupId = ended.sessions[0]?.groupId;

    expect(await reopenSavedTabGroup(savedId)).toBe(savedId);

    const reopened = await browser.waitUntil(
      async () => {
        const snapshot = await readResearchDatabase();
        return snapshot.groups.some((group) => group.title === title) ? snapshot : false;
      },
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "The reopened group never reached the extension." },
    );

    // The finding the session's design rests on: the extension sees the
    // reopened group under the id it recorded, so the group can be recognised.
    expect(reopened.groups.find((group) => group.title === title)?.id).toBe(groupId);
    // Reattaching is not implemented: a reopened group resumes nothing yet.
    expect(reopened.sessions.map((session) => session.status)).toEqual(["saved"]);
  });
});
