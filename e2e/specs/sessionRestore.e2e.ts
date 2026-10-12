import { browser, expect } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickToolbarAction,
  closePopup,
  enterBrowserChrome,
  leaveBrowserChrome,
  placeToolbarAction,
  type PopupSnapshot,
  readPopup,
  readTabGroups,
  submitPopupGroupTitle,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";
import { readResearchDatabase } from "../fixtures/researchDatabase/utils";
import {
  openPageInGroup,
  type PageServer,
  runChromeAfterFlush,
  startPageServer,
  undoCloseTab,
} from "../fixtures/sessionRestore/utils";

let server: PageServer;

/** The page `startSessionWithPage` opens in the session titled `title`. */
const getSessionPageUrl = (title: string): string =>
  `${server.origin}/${encodeURIComponent(title)}`;

/** Waits until the graph holds exactly one open node for `url`. */
const waitForOneOpenNode = async (url: string, description: string): Promise<void> => {
  let openCount = 0;

  await browser.waitUntil(
    async () => {
      const { nodes } = await readResearchDatabase();

      openCount = nodes.filter((node) => node.url === url && node.tabState === "open").length;
      return openCount === 1;
    },
    {
      timeout: UI_TIMEOUT_MS,
      timeoutMsg: `The graph never held one open node for ${description} (last: ${openCount}).`,
    },
  );
};

/** The chrome-context expression for the open group with this label. */
const findGroup = (label: string): string =>
  `gBrowser.tabGroups.find((group) => group.label === ${JSON.stringify(label)})`;

const waitForGroup = async (label: string, present: boolean) => {
  await browser.waitUntil(
    async () => (await readTabGroups()).some((group) => group.label === label) === present,
    {
      timeout: UI_TIMEOUT_MS,
      timeoutMsg: `The group "${label}" was never ${present ? "there" : "gone"}.`,
    },
  );
};

/** Opens the popup and reads it once it shows what `isSettled` waits for. */
const readPopupWhen = async (
  isSettled: (snapshot: PopupSnapshot) => boolean,
  description: string,
): Promise<PopupSnapshot> => {
  await clickToolbarAction();
  await waitForPopupPanel();

  try {
    return await browser.waitUntil(
      async () => {
        const snapshot = await readPopup();
        return isSettled(snapshot) ? snapshot : false;
      },
      { timeout: UI_TIMEOUT_MS, timeoutMsg: `The popup never showed ${description}.` },
    );
  } finally {
    await closePopup();
  }
};

/**
 * Starts a session from the popup, and gives its group a real page beside the
 * new-tab page Firefox opens it with: a group of new-tab pages alone is not
 * kept when it closes.
 */
const startSessionWithPage = async (title: string) => {
  await clickToolbarAction();
  await waitForPopupPanel();
  // The form renders only once the background has answered the popup's
  // question, which waits its turn behind the browser events it is following.
  await browser.waitUntil(async () => (await readPopup()).hasSessionForm, {
    timeout: UI_TIMEOUT_MS,
    timeoutMsg: "The popup never offered to start a session.",
  });
  await submitPopupGroupTitle(title);
  await waitForGroup(title, true);
  await closePopup();

  await openPageInGroup(title, getSessionPageUrl(title));
};

describe("restoring a closed session", () => {
  before(async () => {
    server = await startPageServer();
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await leaveBrowserChrome();
    await server.close();
  });

  afterEach(async () => {
    await closePopup();
    // Each test starts from no open group, so its session is the only live one:
    // removing a group closes its session, and the next start ends it.
    // An ungrouped tab first: restoring a group can take over the window's only
    // blank tab, and removing the last group of a window would close it.
    await runChromeAfterFlush(
      `gBrowser.addTrustedTab("about:blank");
       for (const group of [...gBrowser.tabGroups]) { await gBrowser.removeTabGroup(group); }`,
    );
    // Tabs leave with an animation, so the groups outlive the call that removed them.
    await browser.waitUntil(async () => (await readTabGroups()).length === 0, {
      timeout: UI_TIMEOUT_MS,
      timeoutMsg: "The groups were never removed.",
    });
  });

  it("closes the session with its deleted group, and reopens it when Ctrl+Shift+T restores the group", async () => {
    const title = `Deleted ${Date.now()}`;

    await startSessionWithPage(title);
    await runChromeAfterFlush(`await gBrowser.removeTabGroup(${findGroup(title)});`);
    await waitForGroup(title, false);

    const closed = await readPopupWhen(
      (snapshot) => snapshot.closedSession !== null,
      "the closed session",
    );

    expect(closed.closedSession).toContain(title);
    expect(closed.activeSession).toBeNull();
    expect(closed.hasSessionForm).toBe(true);

    await undoCloseTab();
    await waitForGroup(title, true);

    const reopened = await readPopupWhen(
      (snapshot) => snapshot.activeSession !== null,
      "the reopened session",
    );

    expect(reopened.activeSession).toContain(title);
    expect(reopened.hasSessionForm).toBe(false);
    // The page's tab came back under a new id: its old node is closed and the
    // restored tab has the one open node.
    await waitForOneOpenNode(getSessionPageUrl(title), "the restored group's page");
  });

  it("brings a session tab restored after its group is gone back in a group titled after the session", async () => {
    const title = `Gone ${Date.now()}`;

    await startSessionWithPage(title);
    // Closing a group's tabs one at a time removes the group for good: Firefox
    // keeps only the loose tabs, and restores them outside any group.
    await runChromeAfterFlush(
      `for (const tab of [...${findGroup(title)}.tabs]) { gBrowser.removeTab(tab); }`,
    );
    await waitForGroup(title, false);

    await undoCloseTab();

    const group = await browser.waitUntil(
      async () => (await readTabGroups()).find((candidate) => candidate.label === title),
      {
        timeout: UI_TIMEOUT_MS,
        timeoutMsg: `The restored tab never got a group titled "${title}".`,
      },
    );

    expect(group.tabCount).toBe(1);

    const snapshot = await readPopupWhen(
      (candidate) => candidate.activeSession !== null,
      "the session active again",
    );

    expect(snapshot.activeSession).toContain(title);
    // Recorded on its return, though it shows its page without a new navigation.
    await waitForOneOpenNode(getSessionPageUrl(title), "the restored tab's page");
  });

  it("ends a closed session when a new one starts, so restoring its group does not revive it", async () => {
    const first = `First ${Date.now()}`;
    const second = `Second ${Date.now()}`;

    await startSessionWithPage(first);
    await runChromeAfterFlush(`await gBrowser.removeTabGroup(${findGroup(first)});`);
    await waitForGroup(first, false);

    await startSessionWithPage(second);
    await undoCloseTab();
    await waitForGroup(first, true);

    const snapshot = await readPopupWhen(
      (candidate) => candidate.activeSession !== null,
      "the active session",
    );

    expect(snapshot.activeSession).toContain(second);
    expect(snapshot.closedSession).toBeNull();
  });
});
