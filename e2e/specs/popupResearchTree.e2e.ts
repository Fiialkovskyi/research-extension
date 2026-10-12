import { browser, expect } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickInTabShowing,
  clickPopupButton,
  clickToolbarAction,
  closePopup,
  enterBrowserChrome,
  leaveBrowserChrome,
  loadUrlInSelectedTab,
  placeToolbarAction,
  type PopupSnapshot,
  readPopup,
  readTabGroups,
  readTabs,
  submitPopupGroupTitle,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";
import { PAGE_ORIGIN_VARIABLE } from "../fixtures/pageServer/constants";
import { readResearchDatabase } from "../fixtures/researchDatabase/utils";
import { openPageInGroup } from "../fixtures/sessionRestore/utils";

const readOrigin = (): string => {
  const origin = process.env[PAGE_ORIGIN_VARIABLE];

  if (origin === undefined) {
    throw new Error(`${PAGE_ORIGIN_VARIABLE} is not set; the page server did not start.`);
  }

  return origin;
};

/**
 * Opens the popup and reads it until `condition` holds. The tree arrives over
 * the popup's own connection after it opens, so a first read may precede it.
 * Reading the popup selects no tab, so a page never looked at stays unread.
 */
const waitForPopup = async (
  condition: (snapshot: PopupSnapshot) => boolean,
  description: string,
): Promise<PopupSnapshot> => {
  let snapshot: PopupSnapshot | undefined;

  await clickToolbarAction();
  await waitForPopupPanel();
  await browser
    .waitUntil(
      async () => {
        snapshot = await readPopup();
        return condition(snapshot);
      },
      { timeout: UI_TIMEOUT_MS },
    )
    .catch(() => {
      throw new Error(`The popup never showed ${description} (last: ${JSON.stringify(snapshot)}).`);
    });

  return snapshot as PopupSnapshot;
};

// A search, a result opened from it in a tab of its own, a link followed in
// that tab, and a page set aside in a background tab.
describe("the research tree in the popup", () => {
  const title = `Tree ${Date.now()}`;

  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("draws each page under the page it was reached from, and queues the unread one", async () => {
    const port = new URL(readOrigin()).port;

    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await submitPopupGroupTitle(title);
    await browser.waitUntil(
      async () => (await readTabGroups()).some((group) => group.label === title),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: `No tab group titled "${title}" appeared.` },
    );
    await closePopup();

    await loadUrlInSelectedTab(`http://duckduckgo.com:${port}/?q=e-bike+motors`);
    await clickInTabShowing("?q=e-bike+motors", "#first-result");
    await clickInTabShowing("/a.html", "#to-b");
    await browser.waitUntil(
      async () => (await readResearchDatabase()).nodes.some((node) => node.url.endsWith("/b.html")),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "Page B was never recorded." },
    );
    // Set aside: opened in the group without ever being selected.
    await openPageInGroup(title, `${readOrigin()}/c.html`);

    const popup = await waitForPopup(
      (snapshot) => snapshot.treeRows.length === 4 && snapshot.unreadPages.length === 1,
      "four rows and one unread page",
    );

    expect(popup.treeRows.map(({ text, level }) => [text.replace(/^\W+/u, ""), level])).toEqual([
      [expect.stringContaining("search · e-bike motors"), 1],
      [expect.stringContaining("Page A"), 2],
      [expect.stringContaining("Page B"), 3],
      [expect.stringContaining("Page C"), 1],
    ]);
    expect(popup.treeRows[0]?.expanded).toBe("true");
    expect(popup.treeRows[1]).toMatchObject({ tabState: "closed", expanded: "true" });
    expect(popup.treeRows[3]).toMatchObject({ engagement: "unread", expanded: null });
    expect(popup.unreadCount).toBe("Unread: 1");
    expect(popup.unreadPages).toEqual(["Page C"]);
  });

  it("selects an unread page's tab from the queue, and no longer queues it", async () => {
    await clickPopupButton("unread-page");
    await browser.waitUntil(
      async () => (await readTabs()).some((tab) => tab.selected && tab.url.endsWith("/c.html")),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "Page C's tab was never selected." },
    );
    await closePopup().catch(() => undefined);

    const popup = await waitForPopup(
      (snapshot) => snapshot.unreadCount === "Nothing unread",
      "an empty unread queue",
    );

    expect(popup.unreadPages).toEqual([]);
    await closePopup();
  });
});
