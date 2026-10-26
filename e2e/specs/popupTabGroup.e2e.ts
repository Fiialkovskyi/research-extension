import { browser, expect } from "@wdio/globals";

import { TAB_GROUP_COLORS } from "@/features/tabGroups";

import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickToolbarAction,
  closePopup,
  closeTabGroup,
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

  it("starts a session as a coloured tab group, shows it until its group closes", async () => {
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

    // The session outlives the popup: opened again, it shows the session
    // rather than offering to start another.
    await closePopup();
    await clickToolbarAction();
    await waitForPopupPanel();

    const during = await browser.waitUntil(
      async () => {
        const snapshot = await readPopup();
        return snapshot.activeSession === null ? false : snapshot;
      },
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "The reopened popup never showed the session." },
    );

    expect(during.activeSession).toContain(title);

    // Closing the group's last tab ends the session, so the form comes back.
    await closePopup();
    await closeTabGroup(title);
    // Tab removal finishes after the call returns, and the popup asks for the
    // session once, as it opens: so it opens only once the group is gone.
    await browser.waitUntil(
      async () => !(await readTabGroups()).some((candidate) => candidate.label === title),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: `The group "${title}" was never removed.` },
    );
    await clickToolbarAction();
    await waitForPopupPanel();

    const after = await browser.waitUntil(
      async () => {
        const snapshot = await readPopup();
        return snapshot.hasSessionForm ? snapshot : false;
      },
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "The popup never offered a new session." },
    );

    expect(after.activeSession).toBeNull();
  });
});
